import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ImageRun,
  LineRuleType,
  PageBreak,
  TableLayoutType,
} from 'docx';
import type { ProjectMeta, Category, Asset, ImageData } from '../types';
import coverDecoration from '../assets/cover-decoration.png';

// ==================== Validation ====================

export interface ValidationMissing {
  categoryName: string;
  assetName: string;
  itemLabel: string;
}

export function validateRequired(
  categories: Category[],
  assets: Asset[]
): ValidationMissing[] {
  const missing: ValidationMissing[] = [];
  for (const asset of assets) {
    const cat = categories.find((c) => c.id === asset.categoryId);
    const categoryName = cat?.name || '未知分类';
    for (const item of asset.items) {
      if (item.required && item.images.length === 0) {
        missing.push({ categoryName, assetName: asset.name, itemLabel: item.label });
      }
    }
  }
  return missing;
}

// ==================== Helpers ====================

const MARGINS = { top: 1440, bottom: 1440, left: 1800, right: 1800 };
const MAIN_TABLE_WIDTH_DXA = 8296;
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const SINGLE_BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'auto', space: 0 };

type WordImageType = 'jpg' | 'png' | 'gif' | 'bmp';

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function parseImageData(dataUri: string): Promise<{ buffer: ArrayBuffer; type: WordImageType }> {
  const mimeMatch = dataUri.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,/);
  const normalizedType = normalizeImageType(mimeMatch?.[1] ?? 'png');

  if (!normalizedType) {
    return convertDataUriToPngBuffer(dataUri);
  }

  const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return { buffer, type: normalizedType };
}

async function fetchImageAsBuffer(url: string): Promise<{ buffer: ArrayBuffer; type: WordImageType }> {
  const resp = await fetch(url);
  const blob = await resp.blob();
  const buffer = await blob.arrayBuffer();
  const type = normalizeImageType(blob.type.split('/')[1] || 'png') ?? 'png';
  return { buffer, type };
}

function normalizeImageType(mimeSubtype: string): WordImageType | null {
  const type = mimeSubtype.toLowerCase();
  if (type === 'jpeg' || type === 'pjpeg') return 'jpg';
  if (type === 'x-png') return 'png';
  if (type === 'jpg' || type === 'png' || type === 'gif' || type === 'bmp') {
    return type;
  }
  return null;
}

async function convertDataUriToPngBuffer(dataUri: string): Promise<{ buffer: ArrayBuffer; type: WordImageType }> {
  const image = await loadImage(dataUri);
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('浏览器不支持图片格式转换，无法导出该截图');
  }
  context.drawImage(image, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error('图片格式转换失败'));
    }, 'image/png');
  });
  return { buffer: await blob.arrayBuffer(), type: 'png' };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片加载失败，无法导出该截图'));
    image.src = src;
  });
}

function formatDateChinese(isoDate: string): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const chineseNum = (n: number) => {
    const digits = '〇一二三四五六七八九';
    return String(n).split('').map((c) => digits[parseInt(c)] || c).join('');
  };
  // The source template cover only prints year and month.
  return `${chineseNum(year)}年${chineseNum(month)}月`;
}

function getDateStr(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function templateText(text: string, size = 32, font = '仿宋', bold = false, color = '000000'): TextRun {
  return new TextRun({ text, bold, size, font, color });
}

function ensureAssetTitleSuffix(name: string): string {
  return /[：:]\s*$/.test(name) ? name : `${name}：`;
}

// ==================== Cover Page ====================

async function buildCoverPage(meta: ProjectMeta): Promise<Paragraph[]> {
  let decorationImage: ImageRun | null = null;
  try {
    const { buffer, type } = await fetchImageAsBuffer(coverDecoration);
    decorationImage = new ImageRun({
      data: buffer,
      transformation: { width: 432, height: 144 },
      type,
    });
  } catch {
    console.warn('Failed to load cover decoration image');
  }

  const result: Paragraph[] = [];

  // Spacer to push title down
  result.push(new Paragraph({ spacing: { before: 3000 } }));

  // Title: 测评证据截图要求 (36pt bold, center)
  result.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: '测评证据截图要求', bold: true, size: 72, font: '黑体', color: '000000' })],
    })
  );

  // Version: (V1.0) (18pt bold, center)
  result.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: '(V1.0)', bold: true, size: 36, font: '黑体', color: '000000' })],
    })
  );

  // Gap
  result.push(new Paragraph({ spacing: { before: 60 } }));

  // Decorative image
  if (decorationImage) {
    result.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [decorationImage],
      })
    );
  }

  // Gap
  result.push(new Paragraph({ spacing: { before: 60 } }));

  // Company name (22pt, center) — matching template sz=44
  result.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: meta.unitName || '（请填写单位名称）', size: 44, font: '黑体', color: '000000' })],
    })
  );

  // Date (22pt, center)
  result.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: formatDateChinese(meta.reportDate), size: 44, font: '黑体', color: '000000' })],
    })
  );

  return result;
}

// ==================== Check Item ====================

async function buildAssetItemsTable(items: { label: string; images: ImageData[] }[]): Promise<Table> {
  const rows: TableRow[] = [];

  for (const item of items) {
    rows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: MAIN_TABLE_WIDTH_DXA, type: WidthType.DXA },
            children: [buildCheckItemParagraph(item.label)],
          }),
        ],
      })
    );

    if (item.images.length > 0) {
      rows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: MAIN_TABLE_WIDTH_DXA, type: WidthType.DXA },
              children: [await buildImageGridTable(item.images)],
            }),
          ],
        })
      );
    }
  }

  return new Table({
    width: { size: 0, type: WidthType.AUTO },
    columnWidths: [MAIN_TABLE_WIDTH_DXA],
    layout: TableLayoutType.AUTOFIT,
    margins: { top: 0, bottom: 0, left: 108, right: 108 },
    borders: {
      top: SINGLE_BORDER,
      bottom: SINGLE_BORDER,
      left: SINGLE_BORDER,
      right: SINGLE_BORDER,
      insideHorizontal: SINGLE_BORDER,
      insideVertical: SINGLE_BORDER,
    },
    rows,
  });
}

function buildCheckItemParagraph(label: string): Paragraph {
  return new Paragraph({
    spacing: { line: 360, lineRule: LineRuleType.AUTO },
    children: [templateText(label, 32, '仿宋')],
  });
}

async function buildImageGridTable(images: ImageData[]): Promise<Table> {
  const rows: TableRow[] = [];
  for (let i = 0; i < images.length; i += 2) {
    const rowImages = images.slice(i, i + 2);
    const cells: TableCell[] = [];

    for (const image of rowImages) {
      cells.push(await buildImageCell(image));
    }

    if (rowImages.length === 1) {
      cells.push(
        new TableCell({
          width: { size: 4148, type: WidthType.DXA },
          children: [new Paragraph({})],
          borders: noBorders(),
        })
      );
    }

    rows.push(new TableRow({ children: cells }));
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [4148, 4148],
    borders: noTableBorders(),
    rows,
  });
}

async function buildImageCell(image: ImageData): Promise<TableCell> {
  const { buffer, type } = await parseImageData(image.data);
  const imageRun = new ImageRun({
    data: buffer,
    transformation: { width: 280, height: 210 },
    type,
  });

  const children: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: image.caption ? 20 : 80 },
      children: [imageRun],
    }),
  ];

  if (image.caption) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 10, after: 80 },
        children: [templateText(image.caption, 20, '仿宋', false, '666666')],
      })
    );
  }

  return new TableCell({
    width: { size: 4148, type: WidthType.DXA },
    children,
    borders: noBorders(),
  });
}

function noTableBorders() {
  return {
    top: NO_BORDER,
    bottom: NO_BORDER,
    left: NO_BORDER,
    right: NO_BORDER,
    insideHorizontal: NO_BORDER,
    insideVertical: NO_BORDER,
  };
}

function noBorders() {
  return {
    top: NO_BORDER,
    bottom: NO_BORDER,
    left: NO_BORDER,
    right: NO_BORDER,
  };
}

// ==================== Asset Section ====================

async function buildAssetSection(
  name: string,
  items: { label: string; images: ImageData[] }[]
): Promise<(Paragraph | Table)[]> {
  const elements: (Paragraph | Table)[] = [];

  elements.push(
    new Paragraph({
      style: 'TemplateHeading2',
      children: [templateText(ensureAssetTitleSuffix(name), 32, '楷体', true)],
    })
  );

  elements.push(await buildAssetItemsTable(items));
  elements.push(new Paragraph({}));

  return elements;
}

// ==================== Main Export ====================

export async function exportWordReport(
  meta: ProjectMeta,
  categories: Category[],
  assets: Asset[]
): Promise<void> {
  const sections: (Paragraph | Table)[] = [];

  // --- Cover page ---
  sections.push(...(await buildCoverPage(meta)));
  sections.push(new Paragraph({ children: [new PageBreak()] }));

  // --- Body ---
  let hasWrittenCategory = false;
  for (const cat of categories) {
    const catAssets = assets.filter((a) => a.categoryId === cat.id);
    if (catAssets.length === 0) continue;

    // 每个一级分类独立起页：封面后已经有分页符，所以第一个分类不再额外分页。
    if (hasWrittenCategory) {
      sections.push(new Paragraph({ children: [new PageBreak()] }));
    }

    sections.push(
      new Paragraph({
        style: 'TemplateHeading1',
        children: [templateText(cat.name, 32, '黑体', true)],
      })
    );
    hasWrittenCategory = true;

    for (const asset of catAssets) {
      const items = asset.items.map((item) => ({
        label: item.label,
        images: item.images,
      }));
      sections.push(...(await buildAssetSection(asset.name, items)));
    }
  }

  const doc = new Document({
    title: '测评证据截图要求',
    styles: {
      default: {
        document: {
          run: { font: '仿宋', size: 32, color: '000000' },
        },
      },
      paragraphStyles: [
        {
          id: 'TemplateHeading1',
          name: 'Template Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          paragraph: {
            spacing: { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO },
            outlineLevel: 0,
          },
          run: { font: '黑体', size: 32, bold: true, color: '000000' },
        },
        {
          id: 'TemplateHeading2',
          name: 'Template Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          paragraph: {
            spacing: { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO },
            indent: { left: 425, hanging: 425 },
            outlineLevel: 1,
          },
          run: { font: '楷体', size: 32, bold: true, color: '000000' },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: { margin: MARGINS },
        },
        children: sections,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `测评证据报告_${meta.unitName || '未命名'}_${getDateStr()}.docx`);
}
