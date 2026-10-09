/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  importScripts("/firebase-messaging-sw.js");
  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "registerSW.js",
    "revision": "1872c500de691dce40960bb85481de07"
  }, {
    "url": "index.html",
    "revision": "ea50fb8fba83e65794a6be736a51d15a"
  }, {
    "url": "firebase-messaging-sw.js",
    "revision": "1de64d1af1b45120ea372f404b0dd997"
  }, {
    "url": "assets/web-Dyh0hFII.js",
    "revision": null
  }, {
    "url": "assets/web-DoXrxgiY.js",
    "revision": null
  }, {
    "url": "assets/web-CgoMipIO.js",
    "revision": null
  }, {
    "url": "assets/web-BwqPdSdc.js",
    "revision": null
  }, {
    "url": "assets/purify.es-DBIK8olT.js",
    "revision": null
  }, {
    "url": "assets/index.es-B3x8TJhQ.js",
    "revision": null
  }, {
    "url": "assets/index-CszSIPwF.css",
    "revision": null
  }, {
    "url": "assets/index-CeOtxIso.js",
    "revision": null
  }, {
    "url": "assets/html2canvas.esm-QH1iLAAe.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "2d68885c4362e507502a736a9ef2e0ac"
  }, {
    "url": "notification-badge.png",
    "revision": "e02f0d73f6b75bdb5a4b3e8f25a70511"
  }, {
    "url": "pwa-192x192.png",
    "revision": "de0ea280902a38bd31e8f92b9ea3da02"
  }, {
    "url": "pwa-512x512.png",
    "revision": "bf43b1e8561963746e0d653815bfcf96"
  }, {
    "url": "manifest.webmanifest",
    "revision": "a778d09c8813362865d3efbfdb459933"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
