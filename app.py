# app.py
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from openaq import OpenAQ
import requests
import os
from datetime import datetime, timedelta
import dateutil.parser as dparser



API_KEY = os.getenv("OPENAQ_API_KEY") or "d2a3e44a3f3c5edf8c0a6c01b174dd7c4cdbc3c470d9da78339a5e47383b0f4c"
HEADERS = {"X-API-Key": API_KEY, "Accept": "application/json"}
BASE_V3 = "https://api.openaq.org/v3"


print("Cargando lista de parámetros globales...")
PARAMETERS_MAP = {}

try:
    resp = requests.get(f"{BASE_V3}/parameters", headers=HEADERS, timeout=15)
    if resp.status_code == 200:
        for item in resp.json().get("results", []):
            PARAMETERS_MAP[item["id"]] = {
                "name": item["name"],
                "units": item.get("units"),
                "displayName": item.get("displayName") or item["name"].upper()
            }
        print(f"Parámetros cargados: {len(PARAMETERS_MAP)}")
    else:
        print("Error al cargar parámetros:", resp.status_code)
except Exception as e:
    print("Error cargando parámetros:", e)

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)
client = OpenAQ(api_key=API_KEY)


def _extract_parameter_info(sensor):
    """Devuelve (sensor_id, parameter_id, code, display_name, units) con tolerancia a formatos diferentes."""
    sensor_id = None
    parameter_id = None
    code = None
    display = None
    units = None

    if isinstance(sensor, dict):
        # Manejo de respuestas JSON (v3 API)
        sensor_id = sensor.get("id") or sensor.get("sensorId") or sensor.get("sensorsId")
        param = sensor.get("parameter") or sensor.get("parameters") or {}
        # A veces 'parameter' es string directamente
        if isinstance(param, dict):
            parameter_id = param.get("id") or param.get("parameterId")
            code = param.get("name") or param.get("code") or param.get("parameter")
            display = (
                param.get("displayName")
                or param.get("display_name")
                or param.get("parameter")
                or code
            )
            units = param.get("units") or param.get("unit")
        elif isinstance(param, str):
            code = param
            display = param
        else:
            # fallback: busca directamente en el nivel superior
            code = sensor.get("parameter") or sensor.get("name")
            display = sensor.get("displayName") or sensor.get("display_name") or code
            units = sensor.get("units") or sensor.get("unit")

    else:
        # Manejo de objetos OpenAQ (client.locations.sensors o .list)
        sensor_id = getattr(sensor, "id", None)
        param = getattr(sensor, "parameter", None)
        if param:
            parameter_id = getattr(param, "id", None)
            code = getattr(param, "name", None) or getattr(param, "code", None)
            display = (
                getattr(param, "displayName", None)
                or getattr(param, "display_name", None)
                or code
            )
            units = getattr(param, "units", None) or getattr(param, "unit", None)
        
        # Fallback para cuando la metadata del sensor está directamente en el objeto de la lista (como en tu código de prueba)
        # En tu código de prueba 'sensor' es un objeto que ya tiene el parámetro asociado.
        if not code:
            code = getattr(sensor, "parameterName", None) # a veces se llama asi en el objeto de la lista

    return sensor_id, parameter_id, code, display, units


def _prefer_datetime(it):
    """
    Extrae la mejor fecha UTC disponible en una medición/agg:
    - period.datetimeFrom.utc
    - period.datetimeTo.utc
    - datetime.utc
    - datetime_utc
    - date
    """
    if not it:
        return None
    # period.datetimeFrom.utc
    p = it.get("period") or {}
    if isinstance(p, dict):
        df = (p.get("datetimeFrom") or {}).get("utc")
        if df:
            return df
        dt = (p.get("datetimeTo") or {}).get("utc")
        if dt:
            return dt
    # datetime or date
    d = it.get("datetime") or it.get("date") or {}
    if isinstance(d, dict):
        if d.get("utc"):
            return d.get("utc")
    # direct fields
    return it.get("datetime_utc") or it.get("date") or None


@app.route("/")
def home():
    return send_file(os.path.join(os.path.dirname(__file__), "index.html"))


# -------------------
# Countries / Stations / Parameters
@app.route("/api/countries", methods=["GET"])
def api_countries():
    try:
        resp = client.countries.list(limit=1000)
        results = [{"code": c.code, "name": c.name} for c in resp.results]
        results.sort(key=lambda x: x["name"])
        return jsonify(success=True, count=len(results), results=results)
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


@app.route("/api/stations/<country_code>", methods=["GET"])
def api_stations(country_code):
    try:
        resp = client.locations.list(iso=country_code, limit=500)
        stations = []
        for loc in resp.results:
            stations.append({
                "id": loc.id,
                "name": loc.name,
                "locality": getattr(loc, "locality", None) or "",
                "coordinates": {
                    "latitude": getattr(loc.coordinates, "latitude", None) if getattr(loc, "coordinates", None) else None,
                    "longitude": getattr(loc.coordinates, "longitude", None) if getattr(loc, "coordinates", None) else None
                }
            })
        return jsonify(success=True, count=len(stations), results=stations)
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


@app.route("/api/parameters/<int:station_id>", methods=["GET"])
def api_parameters(station_id):
    try:
        # 💡 Cambio Clave: Usamos locations.get para obtener la metadata completa de la estación/sensores,
        # tal como lo hizo tu código de prueba que funcionó correctamente. Esto usa la API v2.
        resp = client.locations.get(locations_id=station_id)
        
        sensors_out = []
        seen = set()

        # resp.results[0] es la ubicación. Accedemos a sus sensores asociados.
        if not resp.results:
             return jsonify(success=True, count=0, results=[]), 404

        # La propiedad 'sensors' de la ubicación tiene la metadata completa que necesitamos.
        location = resp.results[0]
        sensors_list = getattr(location, 'sensors', [])

        for s in sensors_list:
            sid, pid, code, display, units = _extract_parameter_info(s)

            # Usamos el código o el nombre del parámetro si está disponible
            sensor_name_display = display or code or f"Sensor {sid}"
            
            # Formato de salida mejorado: Nombre del parámetro + (ID Sensor)
            # También incluimos las unidades que son útiles
            final_name = f"{sensor_name_display.upper()} (ID Sensor: {sid}, Unidad: {units if units else 'N/A'})"
            
            # evitar duplicados por ID (aunque no debería pasar con esta ruta)
            if sid in seen:
                continue
            seen.add(sid)

            sensors_out.append({
                "sensor_id": sid,
                "parameter_id": pid,
                "code": code,
                "name": final_name,
                "units": units if units is not None else None
            })

        return jsonify(success=True, count=len(sensors_out), results=sensors_out)
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


@app.route("/api/last_measurement_date/<int:location_id>/<int:parameter_id>", methods=["GET"])
def api_last_measurement_date(location_id, parameter_id):
    """
    Ruta para obtener la última fecha de medición disponible para un parámetro en una ubicación.
    Esto es crucial para limitar los selectores de fecha en el frontend.
    """
    try:
        # Localizar el sensor
        sensor = find_sensor_by_parameter(location_id, parameter_id)
        
        if not sensor:
            return jsonify(success=False, message="No se encontró el sensor asociado al parámetro."), 404

        # Extraer la última fecha del metadata del sensor (v2 location.sensors)
        last_dt_utc = None
        if isinstance(sensor, dict):
             last_dt_utc = (sensor.get("datetimeLast") or {}).get("utc")
        else:
             last_dt_utc = (getattr(sensor, "datetime_last", None) or {}).get("utc")

        if not last_dt_utc:
            # Fallback 1: Intentar con el endpoint /v3/locations/{id}/latest
            url = f"{BASE_V3}/locations/{location_id}/latest"
            r = requests.get(url, headers=HEADERS, timeout=10)
            if r.status_code == 200:
                results = r.json().get("results", [])
                filtered = [m for m in results if int(m.get("sensorsId", -1)) == int(sensor.id)]
                if filtered:
                    last_dt_utc = _prefer_datetime(filtered[0])
            
        if not last_dt_utc:
            # Fallback 2: Usar hoy (como última opción)
            return jsonify(success=True, date_utc=datetime.utcnow().isoformat() + 'Z')

        # Devolver la fecha encontrada
        return jsonify(success=True, date_utc=last_dt_utc)

    except Exception as e:
        return jsonify(success=False, message=f"Error al obtener última fecha: {str(e)}"), 500

# -------------------
# Latest measurement (location latest, filter by sensorsId)
@app.route("/api/sensor_latest/<int:location_id>/<int:sensor_id>", methods=["GET"])
def api_sensor_latest(location_id, sensor_id):
    try:
        url = f"{BASE_V3}/locations/{location_id}/latest"
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code != 200:
            return jsonify(success=False, status=r.status_code, message=r.text), r.status_code

        results = r.json().get("results", [])
        # normalizar comparaciones por int
        filtered = [m for m in results if int(m.get("sensorsId", -1)) == int(sensor_id)]
        if not filtered:
            return jsonify(success=True, count=0, results=[])

        m = filtered[0]

        # 🔁 Inicializamos por defecto
        sensor_name = "Sensor sin nombre"
        unit = m.get("unit")    # puede venir None

        # 1) Intentamos obtener metadata específica del sensor (/v3/sensors/{sensor_id})
        try:
            meta_resp = requests.get(f"{BASE_V3}/sensors/{int(sensor_id)}", headers=HEADERS, timeout=10)
            if meta_resp.status_code == 200:
                meta = meta_resp.json().get("results", [])
                if meta and isinstance(meta, list) and len(meta) > 0:
                    meta0 = meta[0]
                    # parameter puede estar dentro
                    p = meta0.get("parameter") or {}
                    # display name preferido
                    sensor_name = p.get("displayName") or p.get("name") or meta0.get("name") or f"Sensor {sensor_id}"
                    # unidades preferidas desde parameter o desde el propio meta0.unit
                    unit = unit or (p.get("units") if isinstance(p, dict) else None) or meta0.get("unit") or unit
        except Exception:
            # no rompemos si falla la petición a /sensors/{id}
            pass

        # 2) Si aún no tenemos sensor_name o unidad, hacemos fallback revisando sensors en la location
        sensors_resp = None
        sensores_debug = []
        try:
            # Usamos locations.get para tener la metadata completa de los sensores (v2 like)
            sensors_resp = client.locations.get(locations_id=location_id)
            for s in sensors_resp.results[0].sensors:
                sid, pid, code, display, units = _extract_parameter_info(s)
                try:
                    sensores_debug.append(int(sid) if sid is not None else sid)
                except Exception:
                    sensores_debug.append(sid)
                if sid is not None and int(sid) == int(sensor_id):
                    # preferimos display extraída del sensor metadata local
                    # Mejoramos el nombre para que muestre el código del parámetro
                    parameter_code_display = display or code or f"Sensor {sid}"
                    sensor_name = f"{parameter_code_display.upper()} (ID Sensor: {sid})"
                    if not unit:
                        unit = units or (s.get("unit") if isinstance(s, dict) else None)
                    break
        except Exception:
            sensores_debug = []

        # final fallback names/units
        if not sensor_name:
            sensor_name = f"Sensor {sensor_id}"
        if unit is None:
            unit = None    # explícito: puede quedar null

        out = {
            "datetime_utc": _prefer_datetime(m),
            "datetime_local": (m.get("datetime") or {}).get("local") if m.get("datetime") else None,
            "value": m.get("value"),
            "unit": unit,
            "sensor_name": sensor_name,
            "sensorsId": m.get("sensorsId"),
            "locationsId": m.get("locationsId"),
            "coordinates": m.get("coordinates"),
            "debug_sensors_found": sensores_debug    # TEMPORAL: muestra todos los IDs que devuelve la location
        }
        return jsonify(success=True, count=1, results=[out])
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


# -------------------
def find_sensor_by_parameter(location_id, parameter_id):
    """
    Busca el sensor dentro de la location que corresponde al parameter_id.
    Devuelve el sensor (dict/obj) o None.
    """
    try:
        # Usamos locations.get para tener la metadata completa de los sensores
        resp = client.locations.get(locations_id=location_id)
        if not resp.results:
            return None
        
        sensors_list = getattr(resp.results[0], 'sensors', [])

        best = None
        best_dt = None
        # Para evitar el error de 'None' cuando se compara 'parameter_id' con el atributo 'id'
        # Convertimos 'parameter_id' a int/str para asegurar la comparacion
        parameter_id_int = int(parameter_id) if parameter_id is not None else None


        for s in sensors_list:
            sid, pid, code, display, units = _extract_parameter_info(s)
            
            # Comparamos el PID (int)
            param_match = (pid == parameter_id_int)
            
            if param_match:
                # intentar tomar datetimeLast para escoger el sensor con datos más recientes
                dt_str = None
                if isinstance(s, dict):
                    dt_str = (s.get("datetimeLast") or {}).get("utc")
                else:
                    # En la API v2 de OpenAQ, el último datetime está en el objeto de la lista de sensores.
                    dt_str = (getattr(s, "datetime_last", None) or {}).get("utc")
                    
                if dt_str:
                    try:
                        dt = dparser.parse(dt_str)
                    except Exception:
                        dt = None
                else:
                    dt = None
                if best is None or (dt and (best_dt is None or dt > best_dt)):
                    best = s
                    best_dt = dt
        return best
    except Exception:
        return None


def call_sensor_endpoint(sensor_id, suffix, params=None, max_pages=50):
    """
    Helper para llamar a /v3/sensors/{sensor_id}/{suffix} paginando hasta max_pages.
    Devuelve dict: {"ok": bool, "status": int, "text": ..., "results": [...]}
    """
    results = []
    page = 1
    per_page = 1000
    params = params.copy() if params else {}
    params.setdefault("limit", per_page)
    while True:
        params["page"] = page
        url = f"{BASE_V3}/sensors/{sensor_id}/{suffix}"
        r = requests.get(url, headers=HEADERS, params=params, timeout=20)
        if r.status_code != 200:
            # si fallo en p=1 devolvemos error directo
            if page == 1:
                return {"ok": False, "status": r.status_code, "text": r.text, "results": []}
            else:
                return {"ok": False, "status": r.status_code, "text": r.text, "results": results}
        chunk = r.json().get("results", [])
        results.extend(chunk)
        if len(chunk) < per_page or page >= max_pages:
            break
        page += 1
    return {"ok": True, "status": 200, "results": results}


# -------------------
@app.route("/api/measurements/<int:location_id>/<int:parameter_id>", methods=["GET"])
def api_measurements(location_id, parameter_id):
    """
    Compatible con tu frontend:
    Query params:
      - agg: raw | hours | days | monthly | yearly  (default: raw)
      - limit: número (solo para raw), o 'all' (no recomendado)
      - last_days: entero -> usa última medición del sensor y retrocede N días
      - date_from, date_to: ISO datetimes (si se pasan, se usan)
    """
    try:
        agg = (request.args.get("agg") or "raw").lower()
        limit = request.args.get("limit", "100")
        last_days = request.args.get("last_days", None)
        date_from = request.args.get("date_from", None)
        date_to = request.args.get("date_to", None)

        # localizar sensor que corresponde al parameter_id
        sensor = find_sensor_by_parameter(location_id, parameter_id)
        sensor_id = None
        sensor_units = None
        if sensor:
            sensor_id = sensor.get("id") if isinstance(sensor, dict) else getattr(sensor, "id", None)
            # obtener units si están en metadata
            try:
                param = sensor.get("parameter") if isinstance(sensor, dict) else getattr(sensor, "parameter", None)
                if isinstance(param, dict):
                    sensor_units = param.get("units")
                else:
                    # Acceder a la unidad directamente desde el parámetro del objeto sensor (v2)
                    sensor_units = getattr(param, "units", None) if param else None
            except Exception:
                sensor_units = None

        # si last_days es pedido, calcular date_from/date_to usando datetimeLast del sensor (o ahora)
        if last_days and (not date_from):
            try:
                days = int(last_days)
            except Exception:
                days = None
            if days:
                dt_to = None
                if sensor:
                    if isinstance(sensor, dict):
                        dt_str = (sensor.get("datetimeLast") or {}).get("utc")
                    else:
                        dt_str = (getattr(sensor, "datetime_last", None) or {}).get("utc")
                    try:
                        dt_to = dparser.parse(dt_str) if dt_str else datetime.utcnow()
                    except Exception:
                        dt_to = datetime.utcnow()
                else:
                    dt_to = datetime.utcnow()
                dt_from_obj = dt_to - timedelta(days=days)
                date_from = dt_from_obj.isoformat()
                # Ajustar date_to al último día encontrado o hoy
                date_to = dt_to.isoformat()

        # validate date_from/date_to (if provided)
        try:
            if date_from:
                _ = dparser.parse(date_from)
            if date_to:
                _ = dparser.parse(date_to)
        except Exception:
            return jsonify(success=False, message="date_from/date_to no válidas"), 400

        # si no encontramos sensor hacemos fallback a measurements global (location_id + parameter_id)
        if sensor_id is None:
            # fallback simple
            url = f"{BASE_V3}/measurements"
            params = {
                "location_id": location_id,
                "parameters_id": parameter_id,
                "limit": int(limit) if str(limit).isdigit() else 100,
                "order_by": "datetime",
                "sort": "desc"
            }
            if date_from: params["date_from"] = date_from
            if date_to: params["date_to"] = date_to
            r = requests.get(url, headers=HEADERS, params=params, timeout=15)
            if r.status_code != 200:
                return jsonify(success=False, status=r.status_code, message=r.text), r.status_code
            results = r.json().get("results", [])
            out = []
            for it in results:
                dt = _prefer_datetime(it)
                unit = (it.get("parameter") or {}).get("units") or it.get("unit") or sensor_units
                out.append({"datetime_utc": dt, "value": it.get("value"), "unit": unit, "parameter": (it.get("parameter") or {}).get("name")})
            return jsonify(success=True, count=len(out), results=out)

        # mapping agg -> sensor endpoint suffix candidates
        mapping = {
            "raw": ["measurements"],
            "hours": ["hours", "measurements/hourly"],
            "days": ["days", "measurements/daily"],
            "monthly": ["days/monthly", "measurements/monthly"],
            "yearly": ["days/yearly", "measurements/yearly"]
        }
        candidates = mapping.get(agg, ["measurements"])

        params = {}
        # sensor endpoints accept datetime_from / datetime_to (según doc)
        if date_from: params["date_from"] = date_from
        if date_to: params["date_to"] = date_to

        results = []
        last_err = None
        for cand in candidates:
            info = call_sensor_endpoint(sensor_id, cand, params=params, max_pages=40)
            if info.get("ok"):
                results = info["results"]
                last_err = None
                break
            else:
                last_err = {"status": info.get("status"), "text": info.get("text")}

        if not results and last_err:
            return jsonify(success=False, status=last_err.get("status"), message=last_err.get("text")), last_err.get("status", 500)

        # si agg == raw y limit es numerico, recortar
        if agg == "raw" and str(limit).isdigit():
            n = int(limit)
            if n < len(results):
                results = results[:n]

        # formatear salida
        out = []
        for it in results:
            dt = _prefer_datetime(it)
            # unit prefer parameter.units, luego it.unit, luego sensor_units
            unit = None
            if it.get("parameter") and isinstance(it.get("parameter"), dict):
                unit = it.get("parameter", {}).get("units") or sensor_units
            else:
                unit = it.get("unit") or sensor_units
            out.append({
                "datetime_utc": dt,
                "value": it.get("value"),
                "unit": unit,
                "parameter": (it.get("parameter") or {}).get("name")
            })
        return jsonify(success=True, count=len(out), results=out)
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


# Extra: mantenemos la ruta antiguamente usada por ti (/api/aggregated/...) por compatibilidad
@app.route("/api/aggregated/<int:location_id>/<int:sensor_id>/<tipo>", methods=["GET"])
def api_aggregated(location_id, sensor_id, tipo):
    """
    Ruta de compatibilidad para quienes usaban:
      /api/aggregated/<location_id>/<sensor_id>/<tipo> con tipo en days|months|years
    """
    try:
        # buscar última fecha real del sensor (desde locations/latest)
        latest_url = f"{BASE_V3}/locations/{location_id}/latest"
        r = requests.get(latest_url, headers=HEADERS, timeout=10)
        last_dt = None
        if r.status_code == 200:
            for item in r.json().get("results", []):
                if item.get("sensorsId") == sensor_id:
                    last_dt = (item.get("datetime") or {}).get("utc')") if False else (item.get("datetime") or {}).get("utc")    # fallback safe
                    # use prefer if available
                    last_dt = (item.get("datetime") or {}).get("utc") or item.get("datetime_utc")
                    break
        if not last_dt:
            # fallback: try sensors/{id} metadata
            sresp = requests.get(f"{BASE_V3}/sensors/{sensor_id}", headers=HEADERS, timeout=10)
            if sresp.status_code == 200:
                sres = sresp.json().get("results", [])
                if sres:
                    last_dt = (sres[0].get("datetimeLast") or {}).get("utc") or None
        if not last_dt:
            return jsonify(success=False, message="No se encontró última medición"), 404

        dt_end = dparser.parse(last_dt)
        if tipo == "days":
            dt_start = dt_end - timedelta(days=15)
            endpoint = "days"
        elif tipo == "months":
            dt_start = dt_end - timedelta(days=365)
            endpoint = "days/monthly"
        elif tipo == "years":
            dt_start = dt_end - timedelta(days=3650)
            endpoint = "days/yearly"
        else:
            return jsonify(success=False, message="Tipo inválido: usa days|months|years"), 400

        params = {
            "date_from": dt_start.isoformat(),
            "date_to": dt_end.isoformat(),
            "limit": 1000
        }
        info = call_sensor_endpoint(sensor_id, endpoint, params=params, max_pages=40)
        if not info.get("ok"):
            return jsonify(success=False, status=info.get("status"), message=info.get("text")), info.get("status", 500)
        data = info.get("results", [])
        out = []
        for d in data:
            dt = _prefer_datetime(d)
            unit = (d.get("parameter") or {}).get("units") or None
            out.append({"datetime_utc": dt, "value": d.get("value"), "unit": unit})
        return jsonify(success=True, count=len(out), results=out)
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000, threaded=True)
