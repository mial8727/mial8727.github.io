# Training apps

Installable progressive web apps (they work offline). All user data stays in the browser on the user's device.

| App | Open / install | Code |
|---|---|---|
| FitForm: personal strength-training plans with animated exercise demos | https://mial8727.github.io/fitform/ | [`fitform/`](fitform/) |
| Football Fitness: warm-up, core, speed and agility training for young footballers | https://mial8727.github.io/footyfit/ | [`footyfit/`](footyfit/) |

- Landing page linking both apps: https://mial8727.github.io/
- FitForm privacy policy: https://mial8727.github.io/fitform/privacy.html

Each app lives in its own folder with its own manifest scope and service worker, so the two install as separate apps and never touch each other's pages or offline caches. Nothing is installable at the site root.
