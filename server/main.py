import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from server.app.core.config import settings
from server.app.core.database import init_db, SessionLocal
from server.app.models.models import Organization, Site, Lab, AdminUser
from server.app.auth.password import hash_password
from server.app.api.auth_api import router as auth_router
from server.app.api.agent_api import router as agent_router
from server.app.api.admin_api import router as admin_router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Enterprise Fleet Management Server for System Revamp",
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_router)
app.include_router(agent_router)
app.include_router(admin_router)


def seed_initial_admin():
    db = SessionLocal()
    try:
        super_admin = db.query(AdminUser).filter(AdminUser.role == "SuperAdmin").first()
        if not super_admin:
            # Create default Organization
            default_org = db.query(Organization).filter(Organization.name == "System Revamp University Lab").first()
            if not default_org:
                default_org = Organization(name="System Revamp University Lab")
                db.add(default_org)
                db.flush()

                # Default Site & Lab
                default_site = Site(org_id=default_org.id, name="Main Campus", location="Block A")
                db.add(default_site)
                db.flush()

                default_lab = Lab(site_id=default_site.id, name="Computer Lab 1", network_subnet="192.168.1.0/24")
                db.add(default_lab)
                db.flush()

            # Create default SuperAdmin
            default_user = AdminUser(
                org_id=default_org.id,
                email="admin@systemrevamp.local",
                name="Fleet Administrator",
                password_hash=hash_password("Admin@123456"),
                role="SuperAdmin",
                is_active=True,
            )
            db.add(default_user)
            db.commit()
            print("[SERVER] Seeded default SuperAdmin: admin@systemrevamp.local / Admin@123456")
    except Exception as e:
        db.rollback()
        print(f"[SERVER] Error during seeding: {e}")
    finally:
        db.close()


@app.on_event("startup")
def on_startup():
    init_db()
    seed_initial_admin()


@app.get("/")
def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "online",
        "docs_url": "/docs",
    }


if __name__ == "__main__":
    uvicorn.run(
        "server.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True if settings.ENV == "development" else False,
    )
