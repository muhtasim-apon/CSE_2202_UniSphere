import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


@app.get("/api/me")
def get_me(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.removeprefix("Bearer ")

    user_response = supabase.auth.get_user(token)
    user = user_response.user
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    profile_response = (
        supabase.table("profiles").select("*").eq("id", user.id).single().execute()
    )
    profile = profile_response.data

    return {
        "id": user.id,
        "email": user.email,
        "first_name": profile.get("first_name"),
        "last_name": profile.get("last_name"),
        "role": profile.get("role"),
    }
