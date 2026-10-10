import { markup, element, setText } from "./ui/Hud";
import "./ui/styles.css";
import { App } from "./app/App";
element("app").innerHTML = markup;
try {
  new App();
} catch (error) {
  setText(
    "hint",
    `3D表示を起動できません。WebGL対応のブラウザで開いてください。${error instanceof Error ? error.message : ""}`,
  );
  element<HTMLButtonElement>("start").disabled = true;
}
