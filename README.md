<p align="center">
  <a href="https://git.io/typing-svg">
    <img src="https://readme-typing-svg.demolab.com?font=Plus+Jakarta+Sans&weight=600&size=42&pause=1000&color=9400D3&center=true&vCenter=true&width=900&height=120&lines=SHADEX+NYX;VERSION+1.0.0;ENTERPRISE+EDITION" alt="Typing SVG" />
  </a>
</p>

<p align="center">
  <img src="https://i.ibb.co/mV7Jj2Gb/870287ca5418.jpg" width="750" style="border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);" />
</p>

<br>

<p align="center">
  <img src="https://img.shields.io/badge/STATUS-ACTIVE-success?style=for-the-badge&logo=none" />
  <img src="https://img.shields.io/badge/LICENSE-MIT-blue?style=for-the-badge&logo=open-source-initiative" />
  <img src="https://img.shields.io/badge/NODE.JS-%E2%89%A520.X-purple?style=for-the-badge&logo=nodedotjs" />
</p>

---

## 🏛️ Architecture & Quick Actions

Get your own instance running instantly by choosing one of the deployment methods below.

<div align="center">

| Action | Platform | Badge |
| :---: | :---: | :---: |
| **Source Code** | **GitHub (Fork)** | [![FORK REPO](https://img.shields.io/badge/FORK-REPOSITORY-181717?style=for-the-badge&logo=github)](https://github.com/voldigo-anos/CHRISTUS-GOATBOT-PUBLIC/fork) |
| **Cloud Host** | **TalkDrove** | [![Deploy](https://img.shields.io/badge/TALKDROVE-DEPLOY-6C5CE7?style=for-the-badge&logo=rocket)](https://host.talkdrove.com/dashboard/select-bot/prepare-deployment?botId=51) |
| **Sandbox** | **Replit** | [![Replit](https://img.shields.io/badge/REPLIT-RUN-F26207?style=for-the-badge&logo=replit&logoColor=white)](https://repl.it/github/3voldi/Flemme) |
| **Container** | **Koyeb** | [![Koyeb](https://img.shields.io/badge/KOYEB-DEPLOY-121212?style=for-the-badge&logo=koyeb&logoColor=white)](https://app.koyeb.com/auth/signin) |
| **Infrastructure** | **Railway** | [![Railway](https://img.shields.io/badge/RAILWAY-DEPLOY-0B0D0E?style=for-the-badge&logo=railway)](https://railway.app/new) |

</div>

<details>
<summary><b>✨ Alternative Deployment Options</b></summary>
<br>
<div align="center">

| Platform | Quick Link |
| :--- | :--- |
| **Glitch** | <a href="https://glitch.com/signup" target="_blank"><img src="https://img.shields.io/badge/Glitch-000?style=flat-square&logo=glitch&logoColor=white"/></a> |
| **Codespaces** | <a href="https://github.com/codespaces/new" target="_blank"><img src="https://img.shields.io/badge/Codespaces-181717?style=flat-square&logo=github&logoColor=white"/></a> |
| **Render** | <a href="https://dashboard.render.com" target="_blank"><img src="https://img.shields.io/badge/Render-46E3B7?style=flat-square&logo=render&logoColor=black"/></a> |

</div>
</details>

---

## ⚡ CI/CD Pipeline Workflow

The repository includes a pre-configured automation workflow located at `.github/workflows/deploy.yml`.

```yaml
name: Node.js CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20.x]

    steps:
      - name: Checkout repository
        uses: actions/checkout@v3

      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Start application
        run: npm start
