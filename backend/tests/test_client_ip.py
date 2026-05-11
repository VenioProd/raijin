"""Tests for client IP resolution under proxy spoofing."""
from __future__ import annotations

from dataclasses import dataclass

from app.core.client_ip import get_client_ip
from app.core.config import get_settings


@dataclass
class _FakeClient:
    host: str | None


class _FakeRequest:
    def __init__(self, *, peer: str | None, headers: dict[str, str] | None = None) -> None:
        self.client = _FakeClient(peer) if peer is not None else None
        self.headers = headers or {}


def _reset_settings(trusted: str) -> None:
    get_settings.cache_clear()
    import os

    if trusted:
        os.environ["TRUSTED_PROXIES"] = trusted
    else:
        os.environ.pop("TRUSTED_PROXIES", None)


def test_xff_ignored_when_no_trusted_proxies_configured() -> None:
    _reset_settings("")
    request = _FakeRequest(peer="203.0.113.5", headers={"x-forwarded-for": "1.2.3.4"})
    assert get_client_ip(request) == "203.0.113.5"


def test_xff_ignored_when_peer_is_not_a_trusted_proxy() -> None:
    _reset_settings("10.0.0.0/8")
    request = _FakeRequest(peer="203.0.113.5", headers={"x-forwarded-for": "1.2.3.4"})
    assert get_client_ip(request) == "203.0.113.5"


def test_xff_used_when_peer_is_trusted_proxy() -> None:
    _reset_settings("10.0.0.0/8")
    request = _FakeRequest(peer="10.0.0.7", headers={"x-forwarded-for": "1.2.3.4"})
    assert get_client_ip(request) == "1.2.3.4"


def test_xff_takes_leftmost_when_chain_present() -> None:
    _reset_settings("10.0.0.0/8")
    request = _FakeRequest(
        peer="10.0.0.7",
        headers={"x-forwarded-for": "1.2.3.4, 10.0.0.7"},
    )
    assert get_client_ip(request) == "1.2.3.4"


def test_forwarded_header_parsed_when_peer_trusted() -> None:
    _reset_settings("10.0.0.0/8")
    request = _FakeRequest(
        peer="10.0.0.7",
        headers={"forwarded": 'for="192.0.2.60";proto=http;by=10.0.0.7'},
    )
    assert get_client_ip(request) == "192.0.2.60"


def test_no_client_returns_none() -> None:
    _reset_settings("")
    request = _FakeRequest(peer=None)
    assert get_client_ip(request) is None
