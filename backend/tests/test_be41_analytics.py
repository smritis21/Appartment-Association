"""
pytest tests for BE-41 — AI/ML analytics layer.

Story: as the Association President, I want one analytics layer that turns
the numbers every module already produces into trends, anomalies,
forecasts and plain-English summaries, so that insight is not
re-implemented per module.

Covers:
  - aiml.py maths in isolation: moving average, linear forecast (incl.
    clamping and empty input), trend direction/percent, z-score anomalies
    (incl. too-short and zero-variance series), risk scoring
  - GET /analytics/metrics is self-describing and non-empty
  - GET /analytics/insights returns the uniform envelope for every
    registered metric, with an empty database (day-one case) and with
    seeded data
  - Trend, anomaly and forecast values reflect the seeded data
  - Unknown metric -> 400; months outside the range -> 422
  - GET /analytics/risk/{kind} ranks highest-risk first and bands scores;
    unknown kind -> 400
  - The optional LLM seam: off by default (summary_source == "template"),
    used when configured, and falling back to the template when the
    provider raises — verified without any API key or network

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.models.complaint import Complaint, Staff
from app.services import aiml, llm_provider

METRICS_URL = "/api/v1/analytics/metrics"
INSIGHTS_URL = "/api/v1/analytics/insights"
RISK_URL = "/api/v1/analytics/risk"


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _months_ago(months: int) -> datetime:
    now = _now()
    year, month = now.year, now.month
    for _ in range(months):
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    return datetime(year, month, 15, 12, 0, 0)


def seed_complaint(db_session, **overrides) -> None:
    defaults = {
        "category": "Plumbing",
        "description": "Test complaint",
        "location": "A-101",
        "status": "submitted",
        "created_at": _now(),
        "updated_at": _now(),
    }
    defaults.update(overrides)
    db_session.add(Complaint(**defaults))
    db_session.commit()


def seed_staff(db_session, **overrides) -> str:
    defaults = {"name": "Raju Kumar", "role": "maintenance", "phone": "9876500001"}
    defaults.update(overrides)
    staff = Staff(**defaults)
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)
    return staff.staff_id


# ── aiml.py: pure maths ──────────────────────────────────────────────────────

class TestMovingAverage:

    def test_smooths_and_keeps_length(self):
        assert aiml.moving_average([1, 2, 3, 4], window=2) == [1.0, 1.5, 2.5, 3.5]

    def test_empty_series(self):
        assert aiml.moving_average([]) == []

    def test_window_below_one_is_rejected(self):
        with pytest.raises(ValueError):
            aiml.moving_average([1, 2, 3], window=0)


class TestLinearForecast:

    def test_projects_a_rising_line(self):
        assert aiml.linear_forecast([1, 2, 3, 4], periods=2) == [5.0, 6.0]

    def test_never_projects_negative_counts(self):
        # A steep decline would extrapolate below zero; counts are clamped.
        assert all(value >= 0 for value in aiml.linear_forecast([10, 6, 2], periods=4))

    def test_empty_series_and_zero_periods(self):
        assert aiml.linear_forecast([], periods=3) == []
        assert aiml.linear_forecast([1, 2, 3], periods=0) == []

    def test_single_point_is_flat(self):
        assert aiml.linear_forecast([7], periods=2) == [7.0, 7.0]

    def test_negative_periods_rejected(self):
        with pytest.raises(ValueError):
            aiml.linear_forecast([1, 2], periods=-1)


class TestTrend:

    def test_detects_a_rise(self):
        result = aiml.trend([1, 1, 10, 10])
        assert result["direction"] == "up"
        assert result["change_pct"] > 0

    def test_detects_a_fall(self):
        assert aiml.trend([10, 10, 1, 1])["direction"] == "down"

    def test_small_wobble_reads_as_flat(self):
        assert aiml.trend([10, 10, 10, 10])["direction"] == "flat"

    def test_series_too_short(self):
        assert aiml.trend([5])["direction"] == "flat"

    def test_growth_from_zero_does_not_divide_by_zero(self):
        result = aiml.trend([0, 0, 5, 5])
        assert result["direction"] == "up"
        assert result["change_pct"] == 100.0


class TestAnomalies:

    def test_flags_a_spike(self):
        anomalies = aiml.detect_anomalies([2, 2, 2, 2, 2, 40])
        assert len(anomalies) == 1
        assert anomalies[0]["kind"] == "spike"
        assert anomalies[0]["index"] == 5

    def test_short_series_returns_nothing(self):
        assert aiml.detect_anomalies([1, 50]) == []

    def test_flat_series_has_no_anomalies(self):
        assert aiml.detect_anomalies([5, 5, 5, 5, 5]) == []


class TestSaturatingRatio:

    def test_maps_onto_zero_to_one(self):
        assert aiml.saturating_ratio(5, 10) == 0.5

    def test_saturates_above_full_load(self):
        assert aiml.saturating_ratio(230, 10) == 1.0

    def test_never_negative(self):
        assert aiml.saturating_ratio(-3, 10) == 0.0

    def test_full_load_must_be_positive(self):
        with pytest.raises(ValueError):
            aiml.saturating_ratio(5, 0)


class TestRiskScore:

    def test_missing_fields_count_as_zero(self):
        assert aiml.risk_score({}, {"a": 1.0}) == 0.0

    def test_fully_loaded_record_scores_100(self):
        assert aiml.risk_score({"open_load": 1.0}, {"open_load": 1.0}) == 100.0

    def test_score_is_bounded_and_ranks(self):
        low = aiml.risk_score({"open_load": 0.1}, {"open_load": 1.0})
        high = aiml.risk_score({"open_load": 0.8}, {"open_load": 1.0})
        assert 0 <= low < high <= 100

    def test_mitigating_factor_lowers_the_score(self):
        weights = {"open_load": 1.0, "throughput_relief": -0.25}
        without = aiml.risk_score({"open_load": 1.0}, weights)
        with_relief = aiml.risk_score({"open_load": 1.0, "throughput_relief": 1.0}, weights)
        assert with_relief < without

    def test_empty_weights(self):
        assert aiml.risk_score({"a": 5}, {}) == 0.0

    def test_all_negative_weights_cannot_divide_by_zero(self):
        assert aiml.risk_score({"a": 1.0}, {"a": -1.0}) == 0.0


# ── Metric registry ──────────────────────────────────────────────────────────

def test_metrics_registry_is_self_describing(client):
    response = client.get(METRICS_URL)

    assert response.status_code == 200
    body = response.json()
    assert len(body) >= 6
    for entry in body:
        assert entry["metric"] and entry["label"] and entry["module"] and entry["unit"]


def test_every_registered_metric_returns_an_insight(client, db_session):
    """The registry and the insights endpoint must not drift apart."""
    for entry in client.get(METRICS_URL).json():
        response = client.get(INSIGHTS_URL, params={"metric": entry["metric"]})
        assert response.status_code == 200, entry["metric"]
        assert response.json()["metric"] == entry["metric"]


# ── Insights ─────────────────────────────────────────────────────────────────

def test_insight_on_empty_database_still_renders(client, db_session):
    """Day one: a dashboard must render, not 404."""
    body = client.get(INSIGHTS_URL, params={"metric": "complaints_raised"}).json()

    assert body["months"] == 6
    assert len(body["series"]) == 6
    assert all(point["value"] == 0 for point in body["series"])
    assert body["trend"]["direction"] == "flat"
    assert body["anomalies"] == []
    assert body["summary"]


def test_insight_envelope_has_every_section(client, db_session):
    body = client.get(INSIGHTS_URL, params={"metric": "complaints_raised"}).json()

    for key in (
        "metric", "label", "module", "unit", "months", "series", "smoothed",
        "trend", "anomalies", "forecast", "summary", "summary_source", "generated_at",
    ):
        assert key in body


def test_series_reflects_seeded_complaints(client, db_session):
    seed_complaint(db_session, created_at=_now())
    seed_complaint(db_session, created_at=_now())
    seed_complaint(db_session, created_at=_months_ago(2))

    body = client.get(INSIGHTS_URL, params={"metric": "complaints_raised"}).json()
    by_period = {point["period"]: point["value"] for point in body["series"]}

    current = f"{_now().year:04d}-{_now().month:02d}"
    older = f"{_months_ago(2).year:04d}-{_months_ago(2).month:02d}"
    assert by_period[current] == 2
    assert by_period[older] == 1


def test_smoothed_matches_series_length(client, db_session):
    body = client.get(INSIGHTS_URL, params={"metric": "complaints_raised"}).json()
    assert len(body["smoothed"]) == len(body["series"])


def test_forecast_projects_three_future_months(client, db_session):
    body = client.get(INSIGHTS_URL, params={"metric": "complaints_raised"}).json()

    assert len(body["forecast"]) == 3
    last_historical = body["series"][-1]["period"]
    assert all(point["period"] > last_historical for point in body["forecast"])


def test_months_parameter_controls_window(client, db_session):
    body = client.get(INSIGHTS_URL, params={"metric": "complaints_raised", "months": 12}).json()
    assert body["months"] == 12
    assert len(body["series"]) == 12


def test_unknown_metric_returns_400(client):
    response = client.get(INSIGHTS_URL, params={"metric": "not_a_metric"})
    assert response.status_code == 400


def test_months_out_of_range_returns_422(client):
    assert client.get(INSIGHTS_URL, params={"metric": "complaints_raised", "months": 1}).status_code == 422
    assert client.get(INSIGHTS_URL, params={"metric": "complaints_raised", "months": 99}).status_code == 422


def test_metric_is_required(client):
    assert client.get(INSIGHTS_URL).status_code == 422


# ── Risk ─────────────────────────────────────────────────────────────────────

def test_risk_ranks_busiest_staff_first(client, db_session):
    busy = seed_staff(db_session, name="Busy Staffer")
    idle = seed_staff(db_session, name="Idle Staffer")
    for _ in range(5):
        seed_complaint(db_session, status="assigned", assigned_to=busy)

    body = client.get(f"{RISK_URL}/staff_workload").json()

    assert body["items"][0]["id"] == busy
    assert body["items"][0]["score"] > body["items"][-1]["score"]
    assert body["items"][-1]["id"] == idle


def test_risk_bands_and_factors_are_reported(client, db_session):
    staff_id = seed_staff(db_session)
    seed_complaint(db_session, status="assigned", assigned_to=staff_id)

    item = client.get(f"{RISK_URL}/staff_workload").json()["items"][0]

    assert item["band"] in ("low", "medium", "high")
    assert 0 <= item["score"] <= 100
    # Raw counts are surfaced, not the internal normalised features.
    assert item["factors"] == {"assigned_count": 1, "completed_count": 0}


def test_heavily_loaded_staff_are_banded_high(client, db_session):
    """
    A staff member well past the full-load threshold must read as high risk.
    An earlier scoring bug scored 23 open complaints as 19.7/100 ("low").
    """
    staff_id = seed_staff(db_session, name="Swamped")
    for _ in range(15):
        seed_complaint(db_session, status="assigned", assigned_to=staff_id)

    item = client.get(f"{RISK_URL}/staff_workload").json()["items"][0]

    assert item["score"] == 100.0
    assert item["band"] == "high"


def test_lightly_loaded_staff_are_banded_low(client, db_session):
    staff_id = seed_staff(db_session, name="Steady")
    seed_complaint(db_session, status="assigned", assigned_to=staff_id)

    item = client.get(f"{RISK_URL}/staff_workload").json()["items"][0]
    assert item["band"] == "low"


def test_risk_on_empty_database(client, db_session):
    body = client.get(f"{RISK_URL}/staff_workload").json()
    assert body["items"] == []
    assert body["summary"]


def test_unknown_risk_kind_returns_400(client):
    assert client.get(f"{RISK_URL}/not_a_kind").status_code == 400


# ── Optional LLM seam ────────────────────────────────────────────────────────
# The platform must run for anyone with no API key, so the default path is
# asserted first. The enabled path is exercised through the provider seam,
# which needs no key and no network.

def test_llm_is_disabled_by_default(client, db_session):
    assert llm_provider.is_enabled() is False
    body = client.get(INSIGHTS_URL, params={"metric": "complaints_raised"}).json()
    assert body["summary_source"] == "template"


def test_summary_is_used_when_provider_succeeds(client, db_session, monkeypatch):
    monkeypatch.setattr(llm_provider, "is_enabled", lambda: True)
    monkeypatch.setattr(llm_provider.settings, "AI_PROVIDER", "ollama")
    monkeypatch.setattr(llm_provider, "_call_ollama", lambda prompt: "Reworded by the model.")

    body = client.get(INSIGHTS_URL, params={"metric": "complaints_raised"}).json()

    assert body["summary"] == "Reworded by the model."
    assert body["summary_source"] == "llm"


def test_falls_back_to_template_when_provider_fails(client, db_session, monkeypatch):
    """An unreachable model must never break the endpoint."""
    def _boom(prompt):
        raise OSError("connection refused")

    monkeypatch.setattr(llm_provider, "is_enabled", lambda: True)
    monkeypatch.setattr(llm_provider.settings, "AI_PROVIDER", "ollama")
    monkeypatch.setattr(llm_provider, "_call_ollama", _boom)

    response = client.get(INSIGHTS_URL, params={"metric": "complaints_raised"})

    assert response.status_code == 200
    assert response.json()["summary_source"] == "template"
    assert response.json()["summary"]


def test_blank_model_reply_falls_back(client, db_session, monkeypatch):
    monkeypatch.setattr(llm_provider, "is_enabled", lambda: True)
    monkeypatch.setattr(llm_provider.settings, "AI_PROVIDER", "ollama")
    monkeypatch.setattr(llm_provider, "_call_ollama", lambda prompt: "   ")

    body = client.get(INSIGHTS_URL, params={"metric": "complaints_raised"}).json()
    assert body["summary_source"] == "template"


def test_unknown_provider_name_falls_back(client, db_session, monkeypatch):
    monkeypatch.setattr(llm_provider, "is_enabled", lambda: True)
    monkeypatch.setattr(llm_provider.settings, "AI_PROVIDER", "some_unsupported_vendor")

    body = client.get(INSIGHTS_URL, params={"metric": "complaints_raised"}).json()
    assert body["summary_source"] == "template"


class TestProviderHttpPaths:
    """
    Exercises the real urllib request/parse code against a local server that
    mimics the actual Ollama and OpenAI-compatible response shapes.

    The monkeypatched tests above stub _call_ollama out entirely, so they
    prove the fallback logic but never run the HTTP path — which means a
    typo in a URL, request body or response key would go unnoticed until
    someone actually configured a provider. This closes that gap without
    needing an API key or a network.
    """

    @pytest.fixture
    def fake_provider(self):
        import json as _json
        import threading
        from http.server import BaseHTTPRequestHandler, HTTPServer

        received = {}

        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                length = int(self.headers.get("Content-Length", 0))
                received["path"] = self.path
                received["body"] = _json.loads(self.rfile.read(length).decode())
                received["auth"] = self.headers.get("Authorization")

                if self.path.endswith("/api/chat"):
                    payload = {"message": {"role": "assistant", "content": "OLLAMA REPLY"}}
                else:
                    payload = {"choices": [{"message": {"role": "assistant", "content": "OPENAI REPLY"}}]}

                data = _json.dumps(payload).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

            def log_message(self, *args):
                pass

        server = HTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        yield f"http://127.0.0.1:{server.server_port}", received
        server.shutdown()

    def test_ollama_request_and_response_parsing(self, fake_provider, monkeypatch):
        base_url, received = fake_provider
        monkeypatch.setattr(llm_provider.settings, "AI_PROVIDER", "ollama")
        monkeypatch.setattr(llm_provider.settings, "AI_BASE_URL", base_url)
        monkeypatch.setattr(llm_provider.settings, "AI_MODEL", "llama3.2")
        monkeypatch.setattr(llm_provider.settings, "AI_API_KEY", "")

        text, source = llm_provider.rephrase("Template sentence.")

        assert (text, source) == ("OLLAMA REPLY", "llm")
        assert received["path"].endswith("/api/chat")
        assert received["body"]["model"] == "llama3.2"
        assert received["body"]["stream"] is False
        assert [m["role"] for m in received["body"]["messages"]] == ["system", "user"]

    def test_openai_compatible_sends_bearer_key(self, fake_provider, monkeypatch):
        base_url, received = fake_provider
        monkeypatch.setattr(llm_provider.settings, "AI_PROVIDER", "openai_compatible")
        monkeypatch.setattr(llm_provider.settings, "AI_BASE_URL", base_url)
        monkeypatch.setattr(llm_provider.settings, "AI_MODEL", "llama-3.1-8b")
        monkeypatch.setattr(llm_provider.settings, "AI_API_KEY", "test-key-123")

        text, source = llm_provider.rephrase("Template sentence.")

        assert (text, source) == ("OPENAI REPLY", "llm")
        assert received["path"].endswith("/chat/completions")
        assert received["auth"] == "Bearer test-key-123"

    def test_unreachable_provider_falls_back(self, monkeypatch):
        """A configured but dead endpoint must not surface an error."""
        monkeypatch.setattr(llm_provider.settings, "AI_PROVIDER", "ollama")
        # Port 9 is the discard service — reliably nothing useful listening.
        monkeypatch.setattr(llm_provider.settings, "AI_BASE_URL", "http://127.0.0.1:9")
        monkeypatch.setattr(llm_provider.settings, "AI_MODEL", "llama3.2")

        assert llm_provider.rephrase("Template sentence.") == ("Template sentence.", "template")


def test_llm_never_alters_the_computed_numbers(client, db_session, monkeypatch):
    """
    The model only rewords prose. Seeded counts must survive untouched even
    when the provider returns something unrelated.
    """
    seed_complaint(db_session, created_at=_now())
    seed_complaint(db_session, created_at=_now())

    monkeypatch.setattr(llm_provider, "is_enabled", lambda: True)
    monkeypatch.setattr(llm_provider.settings, "AI_PROVIDER", "ollama")
    monkeypatch.setattr(llm_provider, "_call_ollama", lambda prompt: "Nonsense about 9999 complaints.")

    body = client.get(INSIGHTS_URL, params={"metric": "complaints_raised"}).json()
    current = f"{_now().year:04d}-{_now().month:02d}"
    by_period = {point["period"]: point["value"] for point in body["series"]}

    assert by_period[current] == 2
