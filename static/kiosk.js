<!doctype html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Feedback</title>
  <link rel="stylesheet" href="/static/style.css" />
</head>

<body class="kiosk">
  <div class="bg-pattern"></div>

  <main class="kio">
    <header class="kiosk-header">
      <div class="brand-dot"></div>
      <div>
        <h1>Como foi o atendimento?</h1>
        <p>Toque numa opção para registar a sua experiência.</p>
      </div>
    </header>

    <section class="kiosk-grid" aria-label="Escolha de satisfação">
      <button class="kiosk-btn very-happy" data-grau="MUITO_SATISFEITO" aria-label="Muito satisfeito">
        <span class="emoji">😄</span>
        <span class="label">Muito satisfeito</span>
      </button>

      <button class="kiosk-btn happy" data-grau="SATISFEITO" aria-label="Satisfeito">
        <span class="emoji">🙂</span>
        <span class="label">Satisfeito</span>
      </button>

      <button class="kiosk-btn sad" data-grau="INSATISFEITO" aria-label="Insatisfeito">
        <span class="emoji">☹️</span>
        <span class="label">Insatisfeito</span>
      </button>
    </section>

    <footer class="kiosk-footer">
      <span class="hint">Modo kiosk • ecrã completo • ideal para tablet</span>
      <a class="admin-link" href="/admin">Admin</a>
    </footer>
  </main>

  <div id="toast" class="toast" aria-live="polite">
    <div class="toast-inner">
      <div class="toast-icon">✅</div>
      <div>
        <div class="toast-title">Obrigado!</div>
        <div class="toast-sub">O seu feedback foi registado.</div>
      </div>
    </div>
  </div>

  <script src="/static/kiosk.js"></script>
</body>
</html>
