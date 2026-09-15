# Cabina

Cockpit de sesión para intradía en futuros, con journal de inversiones, playbook
por instrumento y calculadoras de riesgo e interés compuesto. Es una sola página:
`index.html` lleva el HTML, el CSS y el JS dentro, sin dependencias de build.
Lo único que carga de fuera son las tipografías de Google Fonts.

Esta carpeta es una **copia estática** del artefacto de Claude donde se
desarrolla la app. El artefacto sigue siendo la versión que se usa a diario.

## Qué hay dentro

| Pestaña | Para qué |
| --- | --- |
| Cabina | Pre-sesión con lista congelable, niveles del día, reglas duras, cuentas prop con la regla de consistencia, sesión de hoy y calendario de resultados. |
| Futuros | Journal de operaciones: resumen, cuentas, análisis (R múltiple, franjas horarias, día de la semana, consistencia) y diario por día. |
| Inversiones | Posiciones y operaciones por mercado, con métricas de asignación y salud de la cartera. |
| Playbook | Una sección por tipo de instrumento: futuros, perpetuos, opciones, cripto, acciones y ETFs, bonos, bienes raíces. |
| Formas de hacer dinero | Ideas por categoría, con estado y notas. |
| Calculadora | Interés compuesto y dimensionado de riesgo a partir de la cuenta y la regla dura. |

Todo está en español y en horario de 12 horas; la hora de referencia es
Nueva York (ET), incluido el cambio de día.

## Dónde se guardan los datos

Depende de dónde se abra la página:

- **Como artefacto de Claude**: base de datos del artefacto (sincroniza entre
  dispositivos) y subida de capturas de pantalla para cada operación.
- **Servida como archivo estático** (GitHub Pages, o abriendo el archivo a
  mano): `localStorage` del navegador. Los datos **no salen del equipo**, no se
  sincronizan y se pierden si se borran los datos del sitio. Las capturas
  quedan en la propia operación como data URI, así que conviene no abusar.

Dicho claro: esta copia sirve para leer el código, versionarlo y tener un
respaldo del sistema. **No trae consigo los datos del artefacto.**

## Abrirla en local

```sh
python3 -m http.server 8000
# luego: http://localhost:8000/cabina/
```

Vale con abrir `cabina/index.html` directamente en el navegador; el
`http.server` solo evita rarezas con `file://`.

La página lleva `robots: noindex, nofollow` y no está en el `sitemap.xml`: es
una herramienta personal, no una página pública del sitio.
