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

  // The deployment workflow refreshes this first-party copy from Google.
  // Loading it from our own origin avoids cross-origin loader warnings.
  const script = document.createElement('script');
  script.async = true;
  script.src = './assets/gtag.js';
  document.head.appendChild(script);
}());
