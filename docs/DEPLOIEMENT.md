# Déploiement

Trois façons de faire tourner Crochet Studio. Elles partagent le même code : il n'y a qu'une
application, livrée de trois manières.

---

## 1. Web — Vercel (recommandé pour l'iPad et Android)

```bash
npm i -g vercel     # une seule fois
vercel              # aperçu
vercel --prod       # mise en ligne
```

`vercel.json` fait trois choses, toutes nécessaires. Le fichier lui-même ne contient aucun
commentaire : Vercel refuse toute clé qu'il ne connaît pas (`headers[0]` should NOT have additional
property `comment`). Les explications vivent donc ici.

| Réglage | Pourquoi |
| --- | --- |
| Réécriture vers `/index.html` | L'application a de vraies URL (`/pattern`, `/projects/:id`). Sans cette règle, recharger la page donnerait un 404 — un fichier statique est servi en premier, le reste tombe sur la coquille. |
| `immutable` sur `/assets/*` | Les noms de fichiers contiennent une empreinte : leur contenu ne change jamais. |
| `must-revalidate` sur `index.html`, `sw.js`, le manifeste | Sans ça, une nouvelle version ne serait jamais remarquée : le navigateur garderait l'ancien service worker. |

**Ce que ça débloque.** En HTTPS, l'installation de l'application devient possible partout :

- **iPad / iPhone** — Safari → Partager → *Sur l'écran d'accueil*. C'est aussi ce qui donne au
  stockage la protection contre l'effacement automatique (voir ARCHITECTURE.md §5).
- **Android** — Chrome propose *Installer l'application* : icône, plein écran, hors connexion.
  C'est une vraie installation, pas un raccourci.
- **Windows / macOS** — Chrome et Edge proposent la même chose.

Rien n'est envoyé sur le serveur : Vercel ne sert que des fichiers. Vos projets restent dans le
navigateur de chaque appareil.

**Conséquence à connaître.** Chaque appareil a sa propre bibliothèque. Pour transporter un projet :
*Réglages → Exporter une sauvegarde*, puis *Restaurer depuis un fichier* sur l'autre appareil.

---

## 2. Windows — application de bureau (Tauri)

```bash
npm run desktop         # fenêtre de développement
npm run desktop:build   # installateur NSIS
```

L'installateur sort dans `src-tauri/target/release/bundle/nsis/`. Il est léger (≈ 2,7 Mo) parce que
WebView2 fait déjà partie de Windows.

---

## 3. Android — APK (préparé, pas encore compilé)

Les scripts et la configuration sont en place :

```bash
npm run android:init    # une seule fois : génère le projet Gradle dans src-tauri/gen/android
npm run android:build   # produit l'APK
```

**Ce qui manque sur cette machine**, et qu'il faut installer avant que ces commandes fonctionnent :

| Outil | État | Comment |
| --- | --- | --- |
| JDK 17+ | ✅ présent (Adoptium 21) | — |
| SDK Android (plateforme 34+) | ❌ absent | Android Studio, ou les *command-line tools* seuls |
| NDK (26 ou 27) | ❌ absent | `sdkmanager "ndk;27.0.12077973"` |
| Cibles Rust Android | ❌ absentes | `rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android` |

Puis les variables d'environnement :

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:NDK_HOME = "$env:ANDROID_HOME\ndk\27.0.12077973"
```

Comptez 4 à 5 Go de téléchargement. L'APK produit n'est pas signé pour le Play Store : pour une
installation directe sur votre propre appareil, c'est suffisant (il faut autoriser les sources
inconnues).

**À savoir avant de s'en donner la peine :** sur Android, l'installation du PWA depuis Vercel donne
déjà une vraie application — icône, plein écran, hors connexion, même stockage local. L'APK
n'apporte qu'une distribution par fichier et l'accès au magasin d'applications.
