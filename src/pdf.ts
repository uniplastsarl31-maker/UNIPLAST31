/** Rasterize the browser layout so French and Arabic text retain their correct shaping. */
export async function createOrderPdf(element: HTMLElement, reference: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);
  await document.fonts.ready;
  const clone = element.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  clone.setAttribute("aria-hidden", "true");
  clone.classList.add("pdf-capture");
  clone.style.cssText =
    "position:absolute;left:-20000px;top:0;width:1050px;max-width:none;background:white;padding:40px;";
  document.body.append(clone);
  try {
    await Promise.all(
      Array.from(clone.querySelectorAll("img")).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.onload = () => resolve();
              img.onerror = () => resolve();
              window.setTimeout(resolve, 5000);
            }),
      ),
    );
    const rect = clone.getBoundingClientRect();
    const breaks = Array.from(clone.querySelectorAll("[data-pdf-block]")).map(
      (e) => e.getBoundingClientRect().bottom - rect.top,
    );
    const canvas = await html2canvas(clone, {
      scale: 1.7,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: 1200,
    });
    const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      }),
      width = 186,
      maxHeight = 269,
      ratio = width / canvas.width,
      limit = Math.floor(maxHeight / ratio),
      scale = canvas.width / rect.width;
    let start = 0,
      page = 0;
    while (start < canvas.height) {
      const target = Math.min(canvas.height, start + limit),
        candidates = breaks
          .map((b) => Math.ceil(b * scale) + 2)
          .filter((b) => b > start + limit * 0.35 && b <= target);
      const end =
        target === canvas.height
          ? target
          : candidates.length
            ? Math.max(...candidates)
            : target;
      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = end - start;
      slice
        .getContext("2d")!
        .drawImage(
          canvas,
          0,
          start,
          canvas.width,
          end - start,
          0,
          0,
          canvas.width,
          end - start,
        );
      if (page++) pdf.addPage();
      pdf.addImage(
        slice.toDataURL("image/jpeg", 0.93),
        "JPEG",
        12,
        12,
        width,
        slice.height * ratio,
      );
      start = end;
    }
    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(120);
      pdf.text(`${reference}   |   ${i}/${total}`, 12, 289);
    }
    return pdf.output("blob");
  } finally {
    clone.remove();
  }
}
