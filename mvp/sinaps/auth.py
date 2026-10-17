"""Autentikasi sederhana: kata sandi PBKDF2 dan token bertanda tangan HMAC (tanpa layanan pihak ketiga).

Mahasiswa masuk dengan NIM + kata sandi. NIM tidak pernah disimpan: ID akun mahasiswa adalah pseudonim
hasil hash NIM (sama dengan pseudonim di log belajar). Dosen masuk dengan username + kata sandi.
"""
import base64
import hashlib
import hmac
import json
import os
import secrets
import time

PEPPER = os.environ.get("SINAPS_PEPPER", "sinaps-icc-2026")
SECRET = (os.environ.get("SINAPS_SECRET") or f"token:{PEPPER}").encode()
# kode untuk mendaftar sebagai dosen; set DOSEN_KEY di produksi
DOSEN_KEY = os.environ.get("DOSEN_KEY") or "SINAPS2026"
DOSEN_KEY_DEFAULT = not os.environ.get("DOSEN_KEY")
TOKEN_TTL = 7 * 24 * 3600
ITER = 120_000


def pseudonym(nim):
    return "S-" + hashlib.sha256(f"{PEPPER}:{nim.strip().lower()}".encode()).hexdigest()[:8].upper()


def dosen_id(username):
    return "D-" + hashlib.sha256(f"{PEPPER}:dosen:{username.strip().lower()}".encode()).hexdigest()[:8].upper()


def hash_password(pw):
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), ITER).hex()
    return f"pbkdf2${ITER}${salt}${dk}"


def check_password(pw, stored):
    try:
        _, it, salt, dk = stored.split("$")
    except (ValueError, AttributeError):
        return False
    calc = hashlib.pbkdf2_hmac("sha256", pw.encode(), salt.encode(), int(it)).hex()
    return hmac.compare_digest(calc, dk)


def _b64(b):
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _unb64(s):
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def pw_version(pw_hash):
    """Sidik kata sandi di dalam token: ganti/reset kata sandi membatalkan token lama."""
    return hashlib.sha256(pw_hash.encode()).hexdigest()[:10]


def make_token(account):
    body = {"sub": account["id"], "role": account["role"], "v": pw_version(account["pw_hash"]),
            "exp": int(time.time()) + TOKEN_TTL}
    payload = _b64(json.dumps(body, separators=(",", ":")).encode())
    sig = _b64(hmac.new(SECRET, payload.encode(), hashlib.sha256).digest())
    return f"{payload}.{sig}"


def read_token(token):
    try:
        payload, sig = token.split(".")
    except (ValueError, AttributeError):
        return None
    good = _b64(hmac.new(SECRET, payload.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(good, sig):
        return None
    try:
        body = json.loads(_unb64(payload))
    except ValueError:
        return None
    if body.get("exp", 0) < time.time():
        return None
    return body


def temp_password():
    alphabet = "abcdefghjkmnpqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(8))


def class_code():
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(6))
