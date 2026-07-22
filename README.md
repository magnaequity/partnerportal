# Magna Equity Partner Portal

Portal operativo para gestionar compra/venta de USD, aprobaciones de tasas, pagos, cuentas, saldos y trazabilidad entre Magna Equity y partners como Yango.

## Stack MVP

- Flask
- SQLite local para demo
- HTML/CSS/JavaScript sin build step
- Gunicorn para Railway

## Ejecutar localmente

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Abrir `http://localhost:5001`.

## Usuarios

User Management crea usuarios reales con password hasheada. Las claves se guardan en base de datos como hash, no en variables de entorno.

## Despliegue Railway

El repo incluye `Procfile` y `railway.json`. Para que el dominio y proyecto pertenezcan a Magna Equity, el deploy debe hacerse desde el workspace/equipo Railway de Magna, conectado al repo `magnaequity/partnerportal`.

## Documentación

Ver [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md) para arquitectura funcional, modelo de datos, flujos, permisos, estados, fases, user stories y criterios de aceptación.
