(function () {
  'use strict';

  const measurementId = 'G-SM0J28NYS4';
  const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

  // Keep local development and automated checks out of production analytics.
  if (localHosts.has(window.location.hostname) || window.location.protocol === 'file:') {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };

  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    anonymize_ip: true
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  script.onerror = function () {
    // Analytics may be blocked by tracking protection or an ad blocker.
    // Tracking is optional and must never prevent the site from working.
  };
  document.head.appendChild(script);
}());
