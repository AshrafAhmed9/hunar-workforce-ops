from datetime import UTC, datetime

import pytest

from app.models import Contact
from app.services.dispatch import ConsentError, assert_dialable


def test_rejects_unverified_contact():
    with pytest.raises(ConsentError):
        assert_dialable(Contact(name="A", phone="+911", consent_status="unverified"))


def test_allows_verified_contact():
    assert_dialable(
        Contact(
            name="A",
            phone="+911",
            consent_status="verified",
            verified_at=datetime.now(UTC),
        )
    )
