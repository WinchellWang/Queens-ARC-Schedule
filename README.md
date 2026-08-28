Welcome to the Queen's ARC Open Rec Schedule.

# How it works

This website automatically syncs with the official Queen's University ARC schedule every few hours to provide an easier mobile-friendly interface for students.

Tap "Queen's ARC Schedule" to refresh the page.

Tap an event to add to calendar.

Data is fetched from: [pgaskin/innosoftfusiongo-schedule](https://github.com/pgaskin/innosoftfusiongo-schedule)

More information and features about this project can be found at: [PWA for ARC Schedule](https://winchellwang.github.io/2025/12/25/ARC_Schedule/)

# Work as an APP (PWA)

This website is a Progressive Web App (PWA). You can install it on your phone or computer for a more app-like experience.

For iPhone/iPad:
1. Open the website in Safari.
2. Tap the "Share" button at the bottom of the screen.
3. Select "Add to Home Screen".

For Android:
1. Open the website in Chrome.
2. Tap the three-dot menu in the top-right corner.
3. Select "Add to Home screen". 

# Contribution

This project is open source, and created by a Ph.D student from Civil Engineering at Queen's University. If you find any issues or have suggestions for improvements, feel free to open an issue or submit a pull request on the GitHub repository.

**[Find more about author](https://winchellwang.github.io/)**

# Run locally with Docker

Build and start the static site with Docker Compose:

```bash
docker compose up --build -d
```

Open <http://localhost:8080> in a browser.

After changing the website files, rebuild the image and recreate the container:

```bash
docker compose up --build -d --force-recreate
```

To stop the site:

```bash
docker compose down
```