# Cenizas de Umbraterra

Juego de acción estilo *souls* en pixel art, hecho con HTML5 Canvas y JavaScript puro.
No necesita compilación ni dependencias: se sube tal cual a GitHub Pages.

> El eclipse devoró el sol. Cinco señores guardan las Grandes Almas que sellan el trono.

## Cómo se juega

| Acción | Teclado / ratón | Táctil |
|---|---|---|
| Moverse | WASD / flechas | Joystick izquierdo |
| Apuntar | Ratón | Automático al enemigo más cercano |
| Ataque ligero (combo) | Clic izquierdo / J | ATACAR |
| Ataque fuerte | Clic derecho / K | FUERTE |
| Rodar (invulnerable un instante) | Espacio | RODAR |
| Correr | Shift | CORRER (mantener) |
| Beber Frasco de Ascuas | Q | FRASCO |
| Usar / cambiar objeto | F / R o rueda | OBJETO / ⇄ |
| Interactuar, descansar, leer | E | E |
| Fijar objetivo | Tab / clic central | FIJAR |
| Mapa | M | MAPA |
| Equipo y opciones | Esc / I | MENÚ |

## Contenido

- **Mapa de 200×200 baldosas** con 7 regiones: Santuario de Enlace, Bosque Marchito, Grutas de Cristal
  (oscuras), Ciénaga Pútrida (agua venenosa), Catacumbas Heladas (hielo resbaladizo), Forja Volcánica
  (lava) y Ciudadela del Eclipse.
- **5 jefes + 1 jefe final**, cada uno con dos fases y patrones propios: Gorvak, Sythra, la Hidra de Fango,
  Halvard, Brasamor y el Soberano del Eclipse.
- **8 minijefes** (Caballero Negro, Troll, Sapo Pestilente, Verdugo Óseo, Demonio de Ceniza,
  dos Gárgolas y el Caballero del Eclipse) y mímicos escondidos entre los cofres.
- **20+ tipos de enemigos** con ataques telegrafiados: cuerpo a cuerpo, embestidas, saltos, proyectiles,
  novas, espirales, rayos giratorios, lluvias de meteoros, picos en línea e invocaciones.
- **14 armas** (5 de jefe) con escalado de Fuerza/Destreza, ataques fuertes distintos y elementos
  (fuego, escarcha, veneno, luz). Mejorables hasta +5 con la herrera.
- **7 anillos**, consumibles (bombas, cuchillos, musgo, hierba, resina, hueso de retorno, almas),
  fragmentos de frasco y cenizas para mejorar la curación.
- Hogueras (descanso, subir de nivel, viaje rápido), almas que se pierden al morir y se recuperan,
  rejas con llave, el Sello del Eclipse, paredes ilusorias con salas secretas y mapa con niebla de guerra.
- Guardado automático en el navegador (`localStorage`).

## Rendimiento

- El suelo se pre-dibuja en trozos de 16×16 baldosas a 16 px por baldosa y se escala ×3 sin suavizado,
  así que cada frame dibuja unas pocas imágenes en lugar de miles de baldosas.
- La luz se calcula en un lienzo a 1/4 de resolución y se escala.
- Solo se simulan los enemigos cercanos al jugador; los sprites se rasterizan una vez y se cachean.
- Opción de calidad baja para equipos modestos.

## Publicar en GitHub Pages

1. Crea un repositorio y sube todos los archivos (`index.html`, `css/`, `js/`, `.nojekyll`).
2. En el repositorio: **Settings → Pages → Build and deployment → Deploy from a branch**,
   rama `main`, carpeta `/ (root)`.
3. El juego quedará en `https://<tu-usuario>.github.io/<repositorio>/`.

Para probarlo en local basta con un servidor estático, por ejemplo:

```bash
python -m http.server 8000
```
