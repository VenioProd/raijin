"""encrypt existing plaintext totp secrets at rest

Revision ID: 20260510_0012
Revises: 20260424_0011
Create Date: 2026-05-10 00:00:00.000000
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "20260510_0012"
down_revision: str | None = "20260424_0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_already_encrypted(value: str) -> bool:
    # Fernet tokens are url-safe base64 starting with the version byte 0x80,
    # which encodes as "gAAAAA". TOTP base32 secrets never produce this prefix.
    return value.startswith("gAAAAA")


def upgrade() -> None:
    from raijin_shared.security import encrypt
    from raijin_shared.security.crypto import CryptoConfigurationError

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT id, totp_secret_encrypted FROM users "
            "WHERE totp_secret_encrypted IS NOT NULL AND totp_secret_encrypted <> ''"
        )
    ).fetchall()

    if not rows:
        return

    try:
        # Trigger ENCRYPTION_KEY validation early with a clear error.
        encrypt("__migration_probe__")
    except CryptoConfigurationError as exc:
        raise RuntimeError(
            "ENCRYPTION_KEY must be set to migrate existing TOTP secrets. "
            "Generate one with raijin_shared.security.generate_key()."
        ) from exc

    for user_id, value in rows:
        if not value or _is_already_encrypted(value):
            continue
        ciphertext = encrypt(value)
        bind.execute(
            sa.text(
                "UPDATE users SET totp_secret_encrypted = :v WHERE id = :id"
            ),
            {"v": ciphertext, "id": user_id},
        )


def downgrade() -> None:
    # Decrypting back to plaintext is intentionally not supported: the previous
    # state stored secrets in the clear and we do not want to recreate that risk.
    pass
