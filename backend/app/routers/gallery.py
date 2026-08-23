"""
Galería de cortes — NOVA BARBER SHOP
========================================
Los barberos suben fotos de sus cortes. El admin puede destacarlas
o desactivarlas. El endpoint público `/gallery` alimenta tanto la
app web como la pantalla de la entrada de la barbería.

Endpoints:
  GET    /gallery                      → público, fotos activas (filtra por branch)
  POST   /gallery                      → barbero sube una foto
  GET    /gallery/featured             → fotos destacadas por el admin
  PATCH  /gallery/{id}                 → admin: edita caption, destaca, desactiva
  DELETE /gallery/{id}                 → admin: elimina foto
  POST   /gallery/upload               → sube imagen a base64 temporal (para preview)
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.security import get_current_admin, get_current_barber, get_current_user
from app.models.models import Barber, Branch, GalleryPhoto, Service, User, UserRole

router = APIRouter(prefix="/gallery", tags=["gallery"])


# ==================== Schemas ====================

class GalleryPhotoCreate(BaseModel):
    image_url: str
    caption: Optional[str] = None
    service_id: Optional[int] = None


class GalleryPhotoUpdate(BaseModel):
    caption: Optional[str] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None


class GalleryPhotoRead(BaseModel):
    id: int
    barber_id: int
    barber_name: str
    branch_id: int
    branch_name: str
    image_url: str
    caption: Optional[str] = None
    service_name: Optional[str] = None
    is_featured: bool
    created_at: datetime


# ==================== Helpers ====================

def _to_read(photo: GalleryPhoto, session: Session) -> GalleryPhotoRead:
    barber = session.get(Barber, photo.barber_id)
    barber_name = ""
    if barber:
        user = session.get(User, barber.user_id)
        barber_name = user.full_name if user else ""
    branch = session.get(Branch, photo.branch_id)
    service = session.get(Service, photo.service_id) if photo.service_id else None

    return GalleryPhotoRead(
        id=photo.id,
        barber_id=photo.barber_id,
        barber_name=barber_name,
        branch_id=photo.branch_id,
        branch_name=branch.name if branch else "",
        image_url=photo.image_url,
        caption=photo.caption,
        service_name=service.name if service else None,
        is_featured=photo.is_featured,
        created_at=photo.created_at,
    )


# ==================== Public endpoints ====================

@router.get("", response_model=List[GalleryPhotoRead])
def list_gallery(
    branch_id: Optional[int] = Query(None, description="Filtrar por sucursal"),
    barber_id: Optional[int] = Query(None, description="Filtrar por barbero"),
    featured_only: bool = Query(False, description="Solo fotos destacadas"),
    limit: int = Query(50, ge=1, le=200),
    session: Session = Depends(get_session),
):
    """
    Público — alimenta la pantalla de la entrada y la web.
    Devuelve fotos activas, ordenadas por más reciente primero.
    """
    stmt = (
        select(GalleryPhoto)
        .where(GalleryPhoto.is_active == True)  # noqa
        .order_by(GalleryPhoto.created_at.desc())
    )
    if branch_id:
        stmt = stmt.where(GalleryPhoto.branch_id == branch_id)
    if barber_id:
        stmt = stmt.where(GalleryPhoto.barber_id == barber_id)
    if featured_only:
        stmt = stmt.where(GalleryPhoto.is_featured == True)  # noqa

    stmt = stmt.limit(limit)
    photos = session.exec(stmt).all()
    return [_to_read(p, session) for p in photos]


@router.get("/featured", response_model=List[GalleryPhotoRead])
def featured_gallery(
    branch_id: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    """Fotos destacadas por el admin — ideales para la pantalla de entrada."""
    stmt = (
        select(GalleryPhoto)
        .where(GalleryPhoto.is_active == True)  # noqa
        .where(GalleryPhoto.is_featured == True)  # noqa
        .order_by(GalleryPhoto.created_at.desc())
        .limit(limit)
    )
    if branch_id:
        stmt = stmt.where(GalleryPhoto.branch_id == branch_id)

    return [_to_read(p, session) for p in session.exec(stmt).all()]


# ==================== Barber endpoints ====================

@router.post("", response_model=GalleryPhotoRead, status_code=201)
def upload_photo(
    payload: GalleryPhotoCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_barber),
):
    """El barbero sube una foto de su trabajo."""
    barber = session.exec(select(Barber).where(Barber.user_id == current_user.id)).first()
    if not barber:
        raise HTTPException(404, "Perfil de barbero no encontrado.")

    photo = GalleryPhoto(
        barber_id=barber.id,
        branch_id=barber.branch_id,
        image_url=payload.image_url,
        caption=payload.caption,
        service_id=payload.service_id,
    )
    session.add(photo)
    session.commit()
    session.refresh(photo)
    return _to_read(photo, session)


@router.get("/mine", response_model=List[GalleryPhotoRead])
def my_photos(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_barber),
):
    """El barbero ve solo sus fotos."""
    barber = session.exec(select(Barber).where(Barber.user_id == current_user.id)).first()
    if not barber:
        raise HTTPException(404, "Perfil de barbero no encontrado.")

    photos = session.exec(
        select(GalleryPhoto)
        .where(GalleryPhoto.barber_id == barber.id)
        .order_by(GalleryPhoto.created_at.desc())
    ).all()
    return [_to_read(p, session) for p in photos]


# ==================== Admin endpoints ====================

@router.patch(
    "/{photo_id}",
    response_model=GalleryPhotoRead,
    dependencies=[Depends(get_current_admin)],
)
def update_photo(
    photo_id: int, payload: GalleryPhotoUpdate, session: Session = Depends(get_session)
):
    """Admin edita, destaca o desactiva una foto."""
    photo = session.get(GalleryPhoto, photo_id)
    if not photo:
        raise HTTPException(404, "Foto no encontrada.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(photo, field, value)
    session.add(photo)
    session.commit()
    session.refresh(photo)
    return _to_read(photo, session)


@router.delete("/{photo_id}", status_code=204, dependencies=[Depends(get_current_admin)])
def delete_photo(photo_id: int, session: Session = Depends(get_session)):
    photo = session.get(GalleryPhoto, photo_id)
    if not photo:
        raise HTTPException(404, "Foto no encontrada.")
    session.delete(photo)
    session.commit()
