const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const appsScript = fs.readFileSync(
  path.join(root, "apps-script", "entregas_actividades.gs"),
  "utf8"
);

const expectedFolderIds = {
  "3441939": "1SLkk986REOKGEFaCyWV7rSeudj7lnUMs",
  "3441942": "1cv0DkFXhkMw22AddqIgC354DhUUHcQck",
  "3441944": "1fZ7atqeSym9ayQylRG47HqKm2xdBbFOf",
  "3441950": "1N49ulJRgbF7ySD3JDRJzFE5czCKFO1KM",
  "3168850": "1fBPzXHU0OHDmKa18Y6V2tnomLyYWgiLp",
  "3168852": "1p9HdGinK1me8PsbaLHYio_OC-idAmorR",
};

for (const [ficha, folderId] of Object.entries(expectedFolderIds)) {
  assert(
    appsScript.includes(`"${ficha}": "${folderId}"`),
    `El Apps Script debe tener configurada la carpeta real de la ficha ${ficha}.`
  );
  assert(
    !appsScript.includes(`"${ficha}": "PEGAR_FOLDER_ID_${ficha}"`),
    `La ficha ${ficha} no debe quedar con placeholder en el Apps Script.`
  );
}

console.log("OK: el Apps Script tiene carpetas reales configuradas para las fichas activas del portal.");
