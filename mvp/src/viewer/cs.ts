// Lapisan tipis di atas Cornerstone3D: memuat volume bank kasus, kuas anotasi, dan overlay kunci jawaban.
import {
  Enums,
  RenderingEngine,
  cache,
  init as csInit,
  utilities as csUtils,
  volumeLoader,
  type Types,
} from '@cornerstonejs/core';
import {
  BrushTool,
  Enums as ToolEnums,
  PanTool,
  StackScrollTool,
  ToolGroupManager,
  WindowLevelTool,
  ZoomTool,
  addTool,
  init as toolsInit,
  segmentation,
  utilities as toolUtils,
} from '@cornerstonejs/tools';

export type CaseGeometry = {
  id: string;
  dimensions: [number, number, number];
  spacing: [number, number, number];
  origin: [number, number, number];
  direction: number[];
};

export type Mode = 'navigasi' | 'kuas' | 'hapus' | 'titik';

const ENGINE_ID = 'sinaps-engine';
const VP_ID = 'sinaps-main';
const TG_ID = 'sinaps-tools';
export const SEG = { jawaban: 'seg-jawaban', kunci: 'seg-kunci', model: 'seg-model' } as const;
export type SegKey = keyof typeof SEG;
const COLORS: Record<SegKey, [number, number, number, number]> = {
  jawaban: [255, 140, 40, 255],
  kunci: [40, 220, 120, 255],
  model: [70, 150, 255, 255],
};

// volume disimpan uint8; ADC disimpan sebagai ADC relatif x 100, jadi rentang 0-200 cocok untuk semua seri
const DEFAULT_VOI: Types.VOIRange = { lower: 0, upper: 200 };

let ready: Promise<void> | null = null;

export function initCornerstone() {
  if (!ready) {
    ready = (async () => {
      csInit();
      toolsInit();
      [WindowLevelTool, PanTool, ZoomTool, StackScrollTool, BrushTool].forEach((t) => addTool(t));
    })();
  }
  return ready;
}

async function fetchVolume(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal memuat ${url}: ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  // berkas disimpan ter-gzip; sebagian server sudah membuka gzip-nya lewat Content-Encoding
  if (buf[0] !== 0x1f || buf[1] !== 0x8b) return buf;
  const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function metadata(g: CaseGeometry, center: number, width: number) {
  return {
    BitsAllocated: 8,
    BitsStored: 8,
    SamplesPerPixel: 1,
    HighBit: 7,
    PhotometricInterpretation: 'MONOCHROME2',
    PixelRepresentation: 0,
    Modality: 'MR',
    ImageOrientationPatient: g.direction.slice(0, 6),
    PixelSpacing: [g.spacing[1], g.spacing[0]],
    FrameOfReferenceUID: `sinaps-${g.id}`,
    Columns: g.dimensions[0],
    Rows: g.dimensions[1],
    voiLut: [{ windowCenter: center, windowWidth: width }],
    VOILUTFunction: 'LINEAR',
  };
}

export class SinapsViewer {
  engine: RenderingEngine;
  element: HTMLDivElement;
  geom: CaseGeometry;
  volumeIds: string[] = [];
  active = 0;
  private segVolumeIds: Partial<Record<SegKey, string>> = {};
  private visible: Record<SegKey, boolean> = { jawaban: true, kunci: false, model: false };

  constructor(element: HTMLDivElement, geom: CaseGeometry) {
    this.element = element;
    this.geom = geom;
    this.engine = new RenderingEngine(ENGINE_ID);
    this.engine.enableElement({
      viewportId: VP_ID,
      type: Enums.ViewportType.ORTHOGRAPHIC,
      element,
      defaultOptions: { orientation: Enums.OrientationAxis.AXIAL, background: [0, 0, 0] as Types.Point3 },
    });
  }

  get viewport() {
    return this.engine.getViewport(VP_ID) as Types.IVolumeViewport;
  }

  async load(files: string[], onProgress?: (n: number) => void) {
    const g = this.geom;
    let done = 0;
    const datas = await Promise.all(
      files.map(async (f) => {
        const d = await fetchVolume(f);
        onProgress?.(++done);
        return d;
      }),
    );
    datas.forEach((data, i) => {
      // tanpa ':' supaya Cornerstone tidak mencari image loader untuk slice volume lokal
      const id = `sinaps_${g.id}_${i}_${Date.now()}`;
      volumeLoader.createLocalVolume(id, {
        scalarData: data,
        dimensions: g.dimensions as Types.Point3,
        spacing: g.spacing as Types.Point3,
        origin: g.origin as Types.Point3,
        direction: g.direction as Types.Mat3,
        metadata: metadata(g, 110, 220) as never,
      });
      this.volumeIds.push(id);
    });
    await this.viewport.setVolumes([{ volumeId: this.volumeIds[0] }]);
    this.viewport.setProperties({ voiRange: DEFAULT_VOI });
    this.createSegmentations();
    this.setupTools();
    this.middleSlice();
    this.viewport.render();
  }

  private createSegmentations() {
    const segs: SegKey[] = ['jawaban', 'kunci', 'model'];
    for (const k of segs) {
      const vid = `${SEG[k]}:${this.volumeIds[0]}`;
      volumeLoader.createAndCacheDerivedLabelmapVolume(this.volumeIds[0], { volumeId: vid });
      this.segVolumeIds[k] = vid;
      segmentation.addSegmentations([
        {
          segmentationId: SEG[k],
          representation: { type: ToolEnums.SegmentationRepresentations.Labelmap, data: { volumeId: vid } },
        },
      ]);
    }
    this.attachSegmentations();
  }

  private attachSegmentations() {
    const segs: SegKey[] = ['kunci', 'model', 'jawaban'];
    for (const k of segs) {
      segmentation.addLabelmapRepresentationToViewport(VP_ID, [{ segmentationId: SEG[k] }]);
      segmentation.config.color.setSegmentIndexColor(VP_ID, SEG[k], 1, COLORS[k] as Types.Color);
      segmentation.config.visibility.setSegmentationRepresentationVisibility(
        VP_ID,
        { segmentationId: SEG[k], type: ToolEnums.SegmentationRepresentations.Labelmap },
        this.visible[k],
      );
    }
    segmentation.segmentationStyle.setStyle(
      { type: ToolEnums.SegmentationRepresentations.Labelmap, segmentationId: SEG.kunci },
      { renderFill: true, fillAlpha: 0.15, renderOutline: true, outlineWidth: 2, renderFillInactive: true, fillAlphaInactive: 0.15, renderOutlineInactive: true, outlineWidthInactive: 2 },
    );
    segmentation.segmentationStyle.setStyle(
      { type: ToolEnums.SegmentationRepresentations.Labelmap, segmentationId: SEG.model },
      { renderFill: false, renderOutline: true, outlineWidth: 2, renderFillInactive: false, renderOutlineInactive: true, outlineWidthInactive: 2 },
    );
    segmentation.segmentationStyle.setRenderInactiveSegmentations(VP_ID, true);
    segmentation.activeSegmentation.setActiveSegmentation(VP_ID, SEG.jawaban);
    segmentation.segmentIndex.setActiveSegmentIndex(SEG.jawaban, 1);
  }

  private setupTools() {
    let tg = ToolGroupManager.getToolGroup(TG_ID);
    if (!tg) tg = ToolGroupManager.createToolGroup(TG_ID)!;
    tg.addViewport(VP_ID, ENGINE_ID);
    [WindowLevelTool.toolName, PanTool.toolName, ZoomTool.toolName, StackScrollTool.toolName].forEach((t) => {
      if (!tg!.hasTool(t)) tg!.addTool(t);
    });
    if (!tg.hasTool('Kuas')) tg.addToolInstance('Kuas', BrushTool.toolName, { activeStrategy: 'FILL_INSIDE_CIRCLE' });
    if (!tg.hasTool('Penghapus')) tg.addToolInstance('Penghapus', BrushTool.toolName, { activeStrategy: 'ERASE_INSIDE_CIRCLE' });
    tg.setToolActive(StackScrollTool.toolName, { bindings: [{ mouseButton: ToolEnums.MouseBindings.Wheel }] });
    tg.setToolActive(ZoomTool.toolName, { bindings: [{ mouseButton: ToolEnums.MouseBindings.Secondary }] });
    tg.setToolActive(PanTool.toolName, { bindings: [{ mouseButton: ToolEnums.MouseBindings.Auxiliary }] });
    this.setMode('navigasi');
    this.setBrushSize(4);
  }

  setMode(mode: Mode) {
    const tg = ToolGroupManager.getToolGroup(TG_ID)!;
    const primary = [{ mouseButton: ToolEnums.MouseBindings.Primary }];
    tg.setToolPassive(WindowLevelTool.toolName);
    tg.setToolPassive('Kuas');
    tg.setToolPassive('Penghapus');
    if (mode === 'navigasi') tg.setToolActive(WindowLevelTool.toolName, { bindings: primary });
    if (mode === 'kuas') tg.setToolActive('Kuas', { bindings: primary });
    if (mode === 'hapus') tg.setToolActive('Penghapus', { bindings: primary });
    segmentation.activeSegmentation.setActiveSegmentation(VP_ID, SEG.jawaban);
  }

  setBrushSize(mm: number) {
    toolUtils.segmentation.setBrushSizeForToolGroup(TG_ID, mm);
  }

  async showSeries(i: number) {
    if (i === this.active) return;
    const cam = this.viewport.getCamera();
    const voi = this.voiByVolume.get(this.volumeIds[this.active]);
    this.voiByVolume.set(this.volumeIds[this.active], this.viewport.getProperties()?.voiRange ?? voi);
    this.active = i;
    await this.viewport.setVolumes([{ volumeId: this.volumeIds[i] }]);
    this.attachSegmentations();
    this.viewport.setCamera(cam);
    this.viewport.setProperties({ voiRange: this.voiByVolume.get(this.volumeIds[i]) ?? DEFAULT_VOI });
    this.viewport.render();
  }

  private voiByVolume = new Map<string, Types.VOIRange | undefined>();

  resetView() {
    this.viewport.resetCamera();
    this.viewport.setProperties({ voiRange: DEFAULT_VOI });
    this.middleSlice();
    this.viewport.render();
  }

  middleSlice() {
    const n = this.viewport.getNumberOfSlices();
    csUtils.jumpToSlice(this.element, { imageIndex: Math.floor(n / 2) });
  }

  /** Lompat ke slice voxel k (berbasis 0) lewat koordinat dunia pusat slice. */
  jumpToVoxel(ijk: [number, number, number]) {
    const vol = cache.getVolume(this.volumeIds[this.active])!;
    const world = vol.imageData!.indexToWorld(ijk as unknown as Types.Point3) as Types.Point3;
    const cam = this.viewport.getCamera();
    const n = cam.viewPlaneNormal!;
    const fp = cam.focalPoint!;
    const d = (world[0] - fp[0]) * n[0] + (world[1] - fp[1]) * n[1] + (world[2] - fp[2]) * n[2];
    const shift = [n[0] * d, n[1] * d, n[2] * d];
    this.viewport.setCamera({
      focalPoint: [fp[0] + shift[0], fp[1] + shift[1], fp[2] + shift[2]] as Types.Point3,
      position: [cam.position![0] + shift[0], cam.position![1] + shift[1], cam.position![2] + shift[2]] as Types.Point3,
    });
    this.viewport.render();
  }

  /** Voxel (i, j, k) dan nilainya di bawah titik kanvas. */
  probe(canvasX: number, canvasY: number) {
    const world = this.viewport.canvasToWorld([canvasX, canvasY]);
    const vol = cache.getVolume(this.volumeIds[this.active]);
    if (!vol) return null;
    const ijk = csUtils.transformWorldToIndex(vol.imageData!, world).map(Math.round) as [number, number, number];
    const [X, Y, Z] = this.geom.dimensions;
    if (ijk.some((v, a) => v < 0 || v >= [X, Y, Z][a])) return { ijk, value: null };
    const value = vol.voxelManager!.getAtIJK(ijk[0], ijk[1], ijk[2]) as number;
    return { ijk, value };
  }

  currentSlice(): number {
    const cam = this.viewport.getCamera();
    const vol = cache.getVolume(this.volumeIds[this.active]);
    if (!vol) return 0;
    return Math.round(csUtils.transformWorldToIndex(vol.imageData!, cam.focalPoint!)[2]);
  }

  worldOfVoxel(ijk: [number, number, number]) {
    const vol = cache.getVolume(this.volumeIds[this.active])!;
    return this.viewport.worldToCanvas(vol.imageData!.indexToWorld(ijk as unknown as Types.Point3) as Types.Point3);
  }

  private segData(k: SegKey) {
    const vol = cache.getVolume(this.segVolumeIds[k]!)!;
    return vol.voxelManager!;
  }

  getMask(k: SegKey = 'jawaban'): Uint8Array {
    const arr = this.segData(k).getCompleteScalarDataArray!() as ArrayLike<number>;
    const out = new Uint8Array(arr.length);
    for (let i = 0; i < arr.length; i++) out[i] = arr[i] ? 1 : 0;
    return out;
  }

  setMask(k: SegKey, mask: Uint8Array) {
    this.segData(k).setCompleteScalarDataArray!(mask);
    segmentation.triggerSegmentationEvents.triggerSegmentationDataModified(SEG[k]);
  }

  setVisible(k: SegKey, on: boolean) {
    this.visible[k] = on;
    segmentation.config.visibility.setSegmentationRepresentationVisibility(
      VP_ID,
      { segmentationId: SEG[k], type: ToolEnums.SegmentationRepresentations.Labelmap },
      on,
    );
    this.viewport.render();
  }

  lockAnswer() {
    const tg = ToolGroupManager.getToolGroup(TG_ID)!;
    tg.setToolDisabled('Kuas');
    tg.setToolDisabled('Penghapus');
    tg.setToolActive(WindowLevelTool.toolName, { bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }] });
  }

  undo() {
    csUtils.HistoryMemo.DefaultHistoryMemo.undo();
    this.viewport.render();
  }

  redo() {
    csUtils.HistoryMemo.DefaultHistoryMemo.redo();
    this.viewport.render();
  }

  capture(maxSide = 640): string {
    const src = this.viewport.getCanvas();
    const s = Math.min(1, maxSide / Math.max(src.width, src.height));
    const c = document.createElement('canvas');
    c.width = Math.round(src.width * s);
    c.height = Math.round(src.height * s);
    c.getContext('2d')!.drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }

  destroy() {
    try {
      segmentation.removeAllSegmentationRepresentations();
      segmentation.removeAllSegmentations();
    } catch {
      /* belum ada segmentasi */
    }
    ToolGroupManager.destroyToolGroup(TG_ID);
    this.engine.destroy();
    for (const id of [...this.volumeIds, ...Object.values(this.segVolumeIds)]) cache.removeVolumeLoadObject(id!);
    this.volumeIds = [];
  }
}

// RLE: run bergantian 0,1,0,1 pada urutan voxel x tercepat (sama dengan server)
export function rleEncode(mask: Uint8Array): number[] {
  const runs: number[] = [];
  let cur = 0;
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    const v = mask[i] ? 1 : 0;
    if (v === cur) n++;
    else {
      runs.push(n);
      cur = v;
      n = 1;
    }
  }
  runs.push(n);
  return runs;
}

export function rleDecode(runs: number[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let pos = 0;
  runs.forEach((r, i) => {
    if (i % 2 === 1) out.fill(1, pos, pos + r);
    pos += r;
  });
  return out;
}
