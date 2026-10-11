(() => {
  'use strict';

  const API_BASE = window.VALERY_API_BASE
    || new URLSearchParams(window.location.search).get('api')
    || new URL('./api', window.location.href).toString().replace(/\/$/, '');
  const form = document.querySelector('[data-auth-form]');
  const message = document.querySelector('.auth-message');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const submitButton = form.querySelector('[type="submit"]');
    const formData = new FormData(form);
    const isRegistration = form.dataset.authForm === 'registro';
    const payload = Object.fromEntries(formData.entries());
    submitButton.disabled = true;
    submitButton.textContent = isRegistration ? 'Creando cuenta...' : 'Verificando...';
    message.textContent = '';

    try {
      const response = await fetch(`${API_BASE}/autenticacion/${isRegistration ? 'registro' : 'iniciar-sesion'}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error?.message || `Error de comunicación (código ${response.status}).`);
      }
      window.location.replace('./index.html');
    } catch (error) {
      message.textContent = error instanceof TypeError
        ? `No se pudo conectar con la API (${API_BASE}). Verifica Apache, MySQL y la configuración.`
        : error.message;
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = isRegistration ? 'Crear cuenta' : 'Entrar al portal';
    }
  });
})();
