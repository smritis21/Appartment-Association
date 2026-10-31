from fastapi.testclient import TestClient

def test_read_announcements(client: TestClient):
    # Create an announcement first
    payload = {
        "title": "Water Supply Interruption",
        "body": "Water will be cut off from 2PM to 4PM.",
        "author": "Maintenance",
        "visibility": "public"
    }
    client.post("/api/v1/announcements/", json=payload)
    
    # Test GET without filters
    response = client.get("/api/v1/announcements/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    
    # Test GET with filter_type=current
    response_current = client.get("/api/v1/announcements/?filter_type=current")
    assert response_current.status_code == 200
    assert len(response_current.json()) >= 1
    
    # Test pagination
    response_page = client.get("/api/v1/announcements/?skip=0&limit=1")
    assert response_page.status_code == 200
    assert len(response_page.json()) == 1
