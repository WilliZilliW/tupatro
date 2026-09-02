import { later } from "../state.js";

/* ============================ overlayt ============================ */
export function overlay(html, after) {
  const wrap = document.getElementById("overlays");
  wrap.innerHTML = '<div class="overlay"><div class="panel">' + html + "</div></div>";
  if (after) after(wrap.querySelector(".panel"));
}

export function closeOverlay() {
  document.getElementById("overlays").innerHTML = "";
}

/* Näyttö tehdään filtin päällä olevassa paneelissa, jotta oma käsi jää näkyviin
   ja järjesteltäväksi päätöksen ajaksi. */
export function declPanel(html, after) {
  const el = document.getElementById("declpanel");
  el.innerHTML = html;
  if (after) after(el);
}

export function closeDeclPanel() {
  const el = document.getElementById("declpanel");
  if (el) el.innerHTML = "";
}

export function toast(msg) {
  const t = document.getElementById("toasts");
  t.innerHTML = '<div class="toast">' + msg + "</div>";
  later(() => {
    t.innerHTML = "";
  }, 2500);
}
