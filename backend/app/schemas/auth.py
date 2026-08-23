from typing import Optional

from pydantic import BaseModel, EmailStr


class ClientRegister(BaseModel):
    full_name: str
    phone: str
    email: Optional[EmailStr] = None
    password: str


class LoginRequest(BaseModel):
    identifier: str  # email o phone — sirve para cliente, barbero y admin
    password: str


class UserPublic(BaseModel):
    id: int
    full_name: str
    phone: str
    email: Optional[str] = None
    role: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
