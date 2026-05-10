from __future__ import annotations

import uuid

from raijin_shared.models.user import User, UserRole

from app.services.gdpr import _anonymize_user


def test_anonymize_user_clears_pii_and_credentials() -> None:
    user = User(
        id=uuid.uuid4(),
        tenant_id=uuid.uuid4(),
        email="real.person@example.com",
        password_hash="$2b$12$realbcrypthash",
        full_name="Real Person",
        role=UserRole.ADMIN,
        is_active=True,
        locale="el",
        notification_preferences={"email_digest": True},
        totp_secret_encrypted="gAAAAAencrypted",
        totp_enabled=True,
        backup_codes=["hash1", "hash2"],
    )

    _anonymize_user(user)

    assert user.email == f"deleted-{user.id}@deleted.local"
    assert user.full_name is None
    assert user.locale == "fr"
    assert user.notification_preferences is None
    assert user.totp_enabled is False
    assert user.totp_secret_encrypted is None
    assert user.backup_codes is None
    assert user.is_active is False
    assert user.password_hash.startswith("!gdpr-anon-")
    # Original hash never survives anonymization, even partially.
    assert "realbcrypthash" not in user.password_hash
