from io import BytesIO

from fastapi.testclient import TestClient

from app.main import app


def test_preview_files_extracts_profile_data():
    client = TestClient(app)
    payload = b"Name: Prashant Singh\nYears of Experience: 3\nPython FastAPI AWS Docker"

    response = client.post(
        "/v1/preview-files",
        files={"resumes": ("prashant_resume.txt", BytesIO(payload), "text/plain")},
    )

    assert response.status_code == 200
    body = response.json()
    assert "previews" in body
    assert body["previews"][0]["status"] == "ok"
    assert body["previews"][0]["candidate_name"] == "Prashant Singh"
    assert body["previews"][0]["years_experience"] == 3.0
