from fastapi.testclient import TestClient

def test_search_announcements(client: TestClient):
    client.post("/api/v1/announcements/", json={
        "title": "Yoga Class",
        "body": "Join us for yoga this Sunday.",
        "author": "Community Admin",
        "visibility": "public",
        "category": "Events"
    })
    
    client.post("/api/v1/announcements/", json={
        "title": "Water Shortage",
        "body": "No water from 2 PM to 4 PM tomorrow.",
        "author": "Maintenance Team",
        "visibility": "public",
        "category": "Maintenance"
    })

    response_keyword = client.get("/api/v1/announcements/search?keyword=Yoga")
    assert response_keyword.status_code == 200
    data_keyword = response_keyword.json()
    assert len(data_keyword) >= 1
    assert any("Yoga" in item["title"] for item in data_keyword)
    
    response_category = client.get("/api/v1/announcements/search?category=Maintenance")
    assert response_category.status_code == 200
    data_category = response_category.json()
    assert len(data_category) >= 1
    assert any(item["category"] == "Maintenance" for item in data_category)
    
    response_empty = client.get("/api/v1/announcements/search?keyword=ZebraNonExistent")
    assert response_empty.status_code == 200
    assert response_empty.json() == []
