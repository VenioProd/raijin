import time
import uuid

import pytest

from app.core.security import (
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token,
    hash_password,
    password_fingerprint_matches,
    verify_password,
)
from app.services.security_management import (
    _totp_at,
    decrypt_totp_secret,
    encrypt_totp_secret,
    hash_secret,
    verify_backup_code,
    verify_totp_code,
)


def test_hash_verify_roundtrip() -> None:
    h = hash_password("correct-horse-battery-staple")
    assert verify_password("correct-horse-battery-staple", h) is True
    assert verify_password("wrong", h) is False


def test_access_token_roundtrip() -> None:
    uid = uuid.uuid4()
    tid = uuid.uuid4()
    token = create_access_token(user_id=uid, tenant_id=tid, role="admin")
    payload = decode_token(token, expected_type="access")
    assert payload["sub"] == str(uid)
    assert payload["tid"] == str(tid)
    assert payload["role"] == "admin"
    assert payload["type"] == "access"


def test_refresh_token_type_enforced() -> None:
    uid = uuid.uuid4()
    tid = uuid.uuid4()
    refresh = create_refresh_token(user_id=uid, tenant_id=tid, role="user")
    with pytest.raises(ValueError):
        decode_token(refresh, expected_type="access")


def test_garbage_token_rejected() -> None:
    with pytest.raises(ValueError):
        decode_token("not.a.jwt", expected_type="access")


def test_password_reset_token_carries_password_fingerprint() -> None:
    uid = uuid.uuid4()
    tid = uuid.uuid4()
    password_hash = hash_password("old-password-2026")
    token = create_password_reset_token(
        user_id=uid, tenant_id=tid, password_hash=password_hash
    )

    payload = decode_token(token, expected_type="password_reset")

    assert payload["sub"] == str(uid)
    assert payload["tid"] == str(tid)
    assert payload["type"] == "password_reset"
    assert password_fingerprint_matches(password_hash, payload["pwd"]) is True
    assert password_fingerprint_matches(hash_password("new-password-2026"), payload["pwd"]) is False


def test_totp_and_backup_codes_verify() -> None:
    secret = "JBSWY3DPEHPK3PXP"
    code = _totp_at(secret, int(time.time() // 30))

    assert verify_totp_code(secret, code) is True
    assert verify_totp_code(secret, "000000") is False
    assert verify_backup_code([hash_secret("ABCD-EFGH-IJKL")], "ABCD-EFGH-IJKL") == []
    assert verify_backup_code([hash_secret("ABCD-EFGH-IJKL")], "wrong") is None


def test_totp_secret_encrypt_roundtrip() -> None:
    secret = "JBSWY3DPEHPK3PXP"
    ciphertext = encrypt_totp_secret(secret)

    assert ciphertext != secret
    assert ciphertext.startswith("gAAAAA"), "Fernet ciphertexts start with gAAAAA"
    assert decrypt_totp_secret(ciphertext) == secret


def test_decrypt_totp_secret_handles_legacy_plaintext() -> None:
    # Existing rows written before the encryption migration must keep working
    # until the data migration encrypts them. decrypt() returns the value as-is.
    legacy_secret = "JBSWY3DPEHPK3PXP"
    assert decrypt_totp_secret(legacy_secret) == legacy_secret
    assert decrypt_totp_secret(None) is None
    assert decrypt_totp_secret("") is None


def test_totp_setup_then_verify_with_encrypted_storage() -> None:
    secret = "JBSWY3DPEHPK3PXP"
    stored = encrypt_totp_secret(secret)

    decrypted = decrypt_totp_secret(stored)
    assert decrypted is not None
    code = _totp_at(decrypted, int(time.time() // 30))
    assert verify_totp_code(decrypted, code) is True
