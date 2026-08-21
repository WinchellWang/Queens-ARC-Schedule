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

  const analyticsUrl = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;

  // Fetch first so a privacy extension's rejection is handled by the promise
  // instead of surfacing as a failed external <script> warning.
  fetch(analyticsUrl, {
    mode: 'cors',
    credentials: 'omit',
    cache: 'force-cache'
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error(`Analytics returned HTTP ${response.status}`);
      }
      return response.blob();
    })
    .then(function (source) {
      const objectUrl = URL.createObjectURL(source);
      const script = document.createElement('script');
      script.async = true;
      script.src = objectUrl;
      script.onload = script.onerror = function () {
        URL.revokeObjectURL(objectUrl);
      };
      document.head.appendChild(script);
    })
    .catch(function () {
      // Tracking is optional and must never prevent the site from working.
    });
}());
