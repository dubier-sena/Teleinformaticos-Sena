"""
Import CUESTIONARIO DE CONOCIMIENTOS PREVIOS answers from Excel into Firestore
for group 10B students (ficha 3441942 or 3441950).
"""

import json
import os
from pathlib import Path
import re
import unicodedata
import datetime
import openpyxl
import urllib.request
import urllib.parse
import urllib.error

# ── Config ────────────────────────────────────────────────────────────────────
XLSX_PATH = r"C:/Users/PC/Downloads/CUESTIONARIO DE CONOCIMIENTOS PREVIOS (respuestas).xlsx"
PROJECT   = "sena-portal"
BASE_URL  = f"https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents"
FICHAS_10B = {"3441942", "3441950"}


def load_local_env():
    """Load simple KEY=VALUE pairs from a local .env file if present."""
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key or key in os.environ:
            continue
        os.environ[key] = value.strip().strip('"').strip("'")


load_local_env()
API_KEY = os.getenv("FIREBASE_API_KEY", "").strip()
if not API_KEY:
    raise RuntimeError(
        "Missing FIREBASE_API_KEY environment variable. "
        "Set it in a local .env file or your shell environment before running this import."
    )

# Excel column index (0-based) -> data-store key
COL_MAP = {
    3:  "contexto-q1",
    4:  "contexto-rel-drive",
    5:  "contexto-rel-excel",
    6:  "contexto-rel-canva",
    7:  "contexto-rel-whatsapp",
    8:  "contexto-tendero",
    9:  "contexto-q4",
    10: "contexto-docente-correo-si",
    11: "contexto-docente-classroom-si",
    12: "contexto-docente-whatsapp-si",
    13: "contexto-docente-usb-si",
    14: "contexto-nube",
    15: "contexto-backup-verificar",
    16: "contexto-backup-seleccionar",
    17: "contexto-backup-copiar",
    18: "contexto-backup-confirmar",
    19: "contexto-info-problem",
    20: "contexto-uso-word-si",
    21: "contexto-uso-excel-si",
    22: "contexto-uso-drive-si",
    23: "contexto-uso-correo-si",
    24: "contexto-uso-meet-si",
    25: "contexto-otanche",
}

# Explicit manual overrides: Excel name (normalized) -> Firestore usernameKey
# Used for ambiguous or partial names where automatic matching would be wrong.
# "stacy" in Firestore has only "sahian stacy" but Excel has "sahian stacy laguna roldan" -> ok auto
# "arciniegas" in Firestore is "katalina" which collides with "katalina.bustos" -> prefer katalina.bustos
# "danna_123." and "danna_trillos123." are duplicates -> prefer danna_trillos123.
# For single-word names that are ambiguous, map manually:
MANUAL_OVERRIDES = {
    # Excel norm -> preferred usernameKey
    "santiago":       "santiago_cruz2010",    # Row 14 just "Santiago" -> likely Santiago Cruz (others have fuller names)
    "valentina":      "valentina",            # Row 18 just "Valentina" -> Angie Valentina Cardona Salazar
    "darly acosta":   "darly",                # darly = DARLY BANESSA AGUILAR ACOSTA
    "katalina bustos": "katalina.bustos",     # prefer the one whose fullName matches exactly
}

# Firestore users to prefer over duplicates (when two Firestore users would match same Excel row)
# danna_trillos123. is the canonical account for Danna valentina betancourt trillos
PREFERRED_ACCOUNTS = {
    "danna valentina betancourt trillos": "danna_trillos123.",
    "angie valentina cardona salazar":    "valentina",       # valentina2 is a duplicate account
}

# ── Helpers ───────────────────────────────────────────────────────────────────
def normalize(text):
    """Lowercase, strip accents, collapse spaces."""
    if not isinstance(text, str):
        text = str(text)
    text = text.strip().lower()
    nfkd = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in nfkd if not unicodedata.combining(c))
    text = re.sub(r"\s+", " ", text).strip()
    return text


def to_str(val):
    """Convert any cell value to string; NaN / None -> empty string."""
    if val is None:
        return ""
    s = str(val)
    if s.lower() in ("nan", "none"):
        return ""
    return s.strip()


def fs_request(method, url, body=None):
    """Minimal Firestore REST helper using urllib."""
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"Content-Type": "application/json"} if data else {},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        raise RuntimeError(f"HTTP {e.code}: {err_body}") from e


def from_fs_val(v):
    if "stringValue"  in v: return v["stringValue"]
    if "integerValue" in v: return str(v["integerValue"])
    if "booleanValue" in v: return v["booleanValue"]
    return None


def token_overlap_score(a_norm, b_norm):
    """
    Bidirectional token overlap score.
    Returns 0-1 where 1 means all tokens of the shorter string appear in the longer.
    """
    ta = set(a_norm.split())
    tb = set(b_norm.split())
    if not ta or not tb:
        return 0.0
    intersection = ta & tb
    # Score based on the shorter name to handle partial names like "Santiago"
    shorter = min(len(ta), len(tb))
    return len(intersection) / shorter


# ── 1. Read Excel ─────────────────────────────────────────────────────────────
print("=" * 60)
print("STEP 1 - Reading Excel file")
print("=" * 60)

wb = openpyxl.load_workbook(XLSX_PATH, data_only=True)
ws = wb.active

rows = list(ws.iter_rows(values_only=True))
header = rows[0]
data_rows = rows[1:]

print(f"Total rows (including header): {len(rows)}")
print(f"Data rows: {len(data_rows)}")

excel_entries = []
for i, row in enumerate(data_rows, start=2):
    name_raw      = to_str(row[1]) if len(row) > 1 else ""
    timestamp_raw = row[0] if row[0] else ""
    if not name_raw:
        print(f"  Row {i}: empty name - skipped")
        continue
    excel_entries.append({
        "row_num":   i,
        "timestamp": timestamp_raw,
        "name_raw":  name_raw,
        "name_norm": normalize(name_raw),
        "values":    row,
    })

print(f"Excel entries with names: {len(excel_entries)}")
for e in excel_entries:
    print(f"  Row {e['row_num']}: {e['name_raw']!r}")


# ── 2. De-duplicate Excel rows (keep latest timestamp per normalised name) ────
print("\n" + "=" * 60)
print("STEP 2 - De-duplicating Excel rows by name")
print("=" * 60)

deduped = {}   # norm_name -> entry
for entry in excel_entries:
    norm = entry["name_norm"]
    if norm not in deduped:
        deduped[norm] = entry
    else:
        existing = deduped[norm]
        try:
            ts_new = entry["timestamp"]
            ts_old = existing["timestamp"]
            if ts_new and ts_old and ts_new > ts_old:
                print(f"  Duplicate '{entry['name_raw']}': keeping row {entry['row_num']} over row {existing['row_num']} (later timestamp)")
                deduped[norm] = entry
            else:
                print(f"  Duplicate '{entry['name_raw']}': keeping row {existing['row_num']} over row {entry['row_num']} (earlier or equal timestamp)")
        except Exception:
            print(f"  Duplicate '{entry['name_raw']}': keeping first (row {existing['row_num']})")

print(f"Unique names after dedup: {len(deduped)}")


# ── 3. Fetch Firestore users (group 10B) ─────────────────────────────────────
print("\n" + "=" * 60)
print("STEP 3 - Fetching users from Firestore (sena_portal_users)")
print("=" * 60)

users_url = f"{BASE_URL}/sena_portal_users?key={API_KEY}&pageSize=200"
users_resp = fs_request("GET", users_url)
all_docs   = users_resp.get("documents", [])
print(f"Total user documents fetched: {len(all_docs)}")

students_10b = []
for doc in all_docs:
    fields = doc.get("fields", {})
    ficha  = from_fs_val(fields["ficha"]) if "ficha" in fields else ""
    if str(ficha) in FICHAS_10B:
        username_key = doc["name"].split("/")[-1]
        full_name    = from_fs_val(fields["fullName"]) if "fullName" in fields else ""
        students_10b.append({
            "usernameKey":    username_key,
            "fullName":       full_name,
            "fullName_norm":  normalize(full_name),
            "ficha":          ficha,
        })

print(f"10B students found: {len(students_10b)}")
for s in students_10b:
    print(f"  {s['usernameKey']!r}  fullName={s['fullName']!r}  norm={s['fullName_norm']!r}")

# Build lookup by usernameKey for manual overrides
student_by_key = {s["usernameKey"]: s for s in students_10b}


# ── 4. Match Excel rows to Firestore students ─────────────────────────────────
print("\n" + "=" * 60)
print("STEP 4 - Matching Excel names to Firestore users")
print("=" * 60)

matched       = []   # list of (entry, student, score, method)
unmatched_xls = []
used_students = set()

for norm_name, entry in deduped.items():
    # Check manual override first
    if norm_name in MANUAL_OVERRIDES:
        key = MANUAL_OVERRIDES[norm_name]
        if key in student_by_key:
            s = student_by_key[key]
            print(f"  MANUAL ({norm_name!r}) -> '{s['fullName']}' ({key})")
            matched.append((entry, s, 1.0, "manual"))
            used_students.add(key)
            continue
        else:
            print(f"  MANUAL override key '{key}' not found in Firestore - falling through to auto")

    # Auto: find best Firestore student by token overlap
    best_student = None
    best_score   = 0.0

    for s in students_10b:
        score = token_overlap_score(norm_name, s["fullName_norm"])
        if score > best_score:
            best_score   = score
            best_student = s

    # Check if preferred account applies
    if best_student:
        pref_key = PREFERRED_ACCOUNTS.get(best_student["fullName_norm"])
        if pref_key and pref_key in student_by_key:
            best_student = student_by_key[pref_key]

    THRESHOLD = 0.5
    if best_student and best_score >= THRESHOLD:
        print(f"  AUTO  ({best_score:.2f}): '{entry['name_raw']}' -> '{best_student['fullName']}' ({best_student['usernameKey']})")
        matched.append((entry, best_student, best_score, "auto"))
        used_students.add(best_student["usernameKey"])
    else:
        score_str = f"{best_score:.2f}" if best_student else "N/A"
        best_name = best_student["fullName"] if best_student else "none"
        print(f"  NO MATCH: '{entry['name_raw']}' (best={score_str} '{best_name}')")
        unmatched_xls.append(entry)

unmatched_students = [s for s in students_10b if s["usernameKey"] not in used_students]


# ── 5. Build and upload Firestore documents ───────────────────────────────────
print("\n" + "=" * 60)
print("STEP 5 - Uploading to Firestore (sena_portal_progress)")
print("=" * 60)

NOW       = datetime.datetime.now(datetime.timezone.utc).isoformat()
SCOPE_KEY = "10b_guia2_html"
FILE_NAME = SCOPE_KEY

upload_results = []

for entry, student, score, method in matched:
    username_key = student["usernameKey"]
    doc_id       = f"__guide_data__:student:{username_key}:{SCOPE_KEY}"

    # Build state dict from Excel columns
    state = {}
    row_vals = entry["values"]
    for col_idx, key in COL_MAP.items():
        raw = row_vals[col_idx] if col_idx < len(row_vals) else None
        state[key] = to_str(raw)

    snapshot = {
        "state":        state,
        "updatedAt":    NOW,
        "importedAt":   NOW,
        "importedFrom": "excel",
    }
    snapshot_json = json.dumps(snapshot, ensure_ascii=False)

    fs_fields = {
        "scopeKey":     {"stringValue": SCOPE_KEY},
        "fileName":     {"stringValue": FILE_NAME},
        "updatedAt":    {"stringValue": NOW},
        "snapshotJson": {"stringValue": snapshot_json},
        "_usernameKey": {"stringValue": username_key},
        "_kind":        {"stringValue": "guide-data"},
    }

    doc_url = (
        f"{BASE_URL}/sena_portal_progress/"
        f"{urllib.parse.quote(doc_id, safe='')}?key={API_KEY}"
    )

    try:
        fs_request("PATCH", doc_url, {"fields": fs_fields})
        print(f"  OK  -> {doc_id}")
        upload_results.append({"status": "ok",    "docId": doc_id, "student": student["fullName"]})
    except RuntimeError as e:
        print(f"  ERR -> {doc_id}")
        print(f"         {e}")
        upload_results.append({"status": "error", "docId": doc_id, "student": student["fullName"], "error": str(e)})


# ── 6. Summary ────────────────────────────────────────────────────────────────
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)

print(f"\nExcel entries processed (after dedup): {len(deduped)}")
print(f"10B students in Firestore:             {len(students_10b)}")
print(f"\nMatched pairs:                         {len(matched)}")

ok_count  = sum(1 for r in upload_results if r["status"] == "ok")
err_count = sum(1 for r in upload_results if r["status"] == "error")
print(f"  Uploads OK:   {ok_count}")
print(f"  Uploads ERR:  {err_count}")

print("\nMatch table:")
print(f"  {'Excel name':<42} {'Firestore user':<35} {'Score':>6} {'Method'}")
print("  " + "-" * 92)
for entry, student, score, method in matched:
    print(f"  {entry['name_raw']:<42} {student['fullName']:<35} {score:>5.2f}  {method}")

if unmatched_xls:
    print(f"\nUnmatched Excel names ({len(unmatched_xls)}) - no Firestore user found:")
    for e in unmatched_xls:
        print(f"  - {e['name_raw']!r}")

if unmatched_students:
    print(f"\nFirestore 10B students with no Excel match ({len(unmatched_students)}):")
    for s in unmatched_students:
        print(f"  - {s['fullName']!r} ({s['usernameKey']})")

if err_count:
    print(f"\nUpload errors:")
    for r in upload_results:
        if r["status"] == "error":
            print(f"  - {r['docId']}: {r['error']}")

print("\nDone.")
