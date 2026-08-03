import type { Page } from "@playwright/test";

/**
 * A fresh IndexedDB profile shows the first-run metadata welcome dialog
 * (F2) over the shell — dismiss it so tests can interact with the app.
 */
export async function dismissWelcome(page: Page): Promise<void> {
  await page.getByTestId("welcome-later").click();
}

/**
 * Marca o projeto aberto como vindo de uma importação de PDF.
 *
 * A conformidade só abre a revisão de importação quando existe relatório
 * persistido: sem ele, um `%% TODO(...)` digitado à mão é só um comentário do
 * aluno. Como a importação de verdade precisa de um PDF, o relatório é gravado
 * direto no IndexedDB — o mesmo lugar em que o aplicativo o procura — e a
 * página recarrega para que a leitura do relatório aconteça.
 *
 * Chamar depois de o aplicativo já ter aberto o banco: abrir sem versão antes
 * disso criaria um banco vazio, sem o armazém `settings`.
 */
export async function seedImportReport(page: Page): Promise<void> {
  await page.evaluate(
    ([dbName, key]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(dbName as string);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains("settings")) {
            db.close();
            reject(new Error("o aplicativo ainda não criou o armazém settings"));
            return;
          }
          const tx = db.transaction("settings", "readwrite");
          tx.objectStore("settings").put(
            { schemaVersion: 1, pendencias: [], staticPendencies: [] },
            key as string,
          );
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    ["uecetexlive", "import-report:uecetex2"],
  );
  await page.reload();
  // O `welcomeSeen` fica gravado, então o diálogo não costuma voltar — mas a
  // gravação é assíncrona e não vale travar o teste por causa dela.
  const later = page.getByTestId("welcome-later");
  await later.waitFor({ state: "visible", timeout: 2000 }).catch(() => {});
  if (await later.isVisible().catch(() => false)) await later.click();
}
