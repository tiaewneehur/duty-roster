/* ตัวสร้างไฟล์ .xlsx แบบเบา (ไม่ใช้ไลบรารีภายนอก) รองรับสี ขอบ ตัวหนา ผสานเซลล์ ตรึงแถว/คอลัมน์ */
(function () {
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  var crcT = null;
  function crc32(b) {
    if (!crcT) { crcT = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; } }
    var c2 = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c2 = crcT[(c2 ^ b[i]) & 255] ^ (c2 >>> 8); return (c2 ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(files) {
    var enc = new TextEncoder(), parts = [], central = [], off = 0;
    function u16(v) { return [v & 255, (v >> 8) & 255]; }
    function u32(v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; }
    files.forEach(function (f) {
      var name = enc.encode(f.name), data = enc.encode(f.data), crc = crc32(data);
      var head = [0x50, 0x4b, 3, 4].concat(u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0));
      parts.push(new Uint8Array(head), name, data);
      central.push({ name: name, crc: crc, size: data.length, off: off });
      off += head.length + name.length + data.length;
    });
    var cdStart = off, cdSize = 0;
    central.forEach(function (c) {
      var h = [0x50, 0x4b, 1, 2].concat(u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0x21), u32(c.crc), u32(c.size), u32(c.size), u16(c.name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(c.off));
      parts.push(new Uint8Array(h), c.name); cdSize += h.length + c.name.length;
    });
    parts.push(new Uint8Array([0x50, 0x4b, 5, 6].concat(u16(0), u16(0), u16(central.length), u16(central.length), u32(cdSize), u32(cdStart), u16(0))));
    var tot = 0; parts.forEach(function (p) { tot += p.length; });
    var out = new Uint8Array(tot), p0 = 0; parts.forEach(function (p) { out.set(p, p0); p0 += p.length; });
    return out;
  }

  // style registry
  function Styles() {
    this.fonts = ['<font><sz val="10"/><name val="Tahoma"/></font>'];
    this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    this.map = {};
  }
  Styles.prototype._idx = function (arr, x) { var i = arr.indexOf(x); if (i < 0) { arr.push(x); i = arr.length - 1; } return i; };
  Styles.prototype.get = function (o) {
    o = o || {};
    var key = JSON.stringify(o); if (this.map[key] !== undefined) return this.map[key];
    var f = '<font>' + (o.b ? '<b/>' : '') + (o.i ? '<i/>' : '') + '<sz val="' + (o.sz || 10) + '"/>' + (o.color ? '<color rgb="FF' + o.color + '"/>' : '') + '<name val="Tahoma"/></font>';
    var fi = this._idx(this.fonts, f);
    var fl = o.fill ? this._idx(this.fills, '<fill><patternFill patternType="solid"><fgColor rgb="FF' + o.fill + '"/><bgColor indexed="64"/></patternFill></fill>') : 0;
    var bd = 0;
    if (o.border) { var c = '<color rgb="FF' + (o.border === true ? 'D9D2C6' : o.border) + '"/>'; bd = this._idx(this.borders, '<border><left style="thin">' + c + '</left><right style="thin">' + c + '</right><top style="thin">' + c + '</top><bottom style="thin">' + c + '</bottom><diagonal/></border>'); }
    var al = '<alignment horizontal="' + (o.h || 'left') + '" vertical="center"' + (o.wrap ? ' wrapText="1"' : '') + '/>';
    var xf = '<xf numFmtId="0" fontId="' + fi + '" fillId="' + fl + '" borderId="' + bd + '" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' + al + '</xf>';
    this.xfs.push(xf); var id = this.xfs.length - 1; this.map[key] = id; return id;
  };
  Styles.prototype.xml = function () {
    function wrap(tag, arr) { return '<' + tag + ' count="' + arr.length + '">' + arr.join('') + '</' + tag + '>'; }
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + wrap('fonts', this.fonts) + wrap('fills', this.fills) + wrap('borders', this.borders) +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' + wrap('cellXfs', this.xfs) + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  };

  // sheets: [{name, rows:[[{v,s}|null]], cols:[width], heights:{rowIndex:pt}, merges:['A1:C1'], freeze:{r,c}, landscape:true}]
  function build(sheets, styles) {
    var files = [];
    files.push({ name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>' });
    files.push({ name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' });
    files.push({ name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map(function (s, i) { return '<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets></workbook>' });
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') + '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' });
    files.push({ name: 'xl/styles.xml', data: styles.xml() });
    sheets.forEach(function (s, i) {
      var x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>';
      var fz = s.freeze;
      x += '<sheetViews><sheetView workbookViewId="0" showGridLines="0">' + (fz ? '<pane xSplit="' + fz.c + '" ySplit="' + fz.r + '" topLeftCell="' + colName(fz.c) + (fz.r + 1) + '" activePane="bottomRight" state="frozen"/>' : '') + '</sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/>';
      x += '<cols>' + s.cols.map(function (w, ci) { return '<col min="' + (ci + 1) + '" max="' + (ci + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('') + '</cols><sheetData>';
      s.rows.forEach(function (row, ri) {
        var ht = s.heights && s.heights[ri];
        x += '<row r="' + (ri + 1) + '"' + (ht ? ' ht="' + ht + '" customHeight="1"' : '') + '>';
        row.forEach(function (c, ci) {
          if (!c) return;
          var ref = colName(ci) + (ri + 1), sty = c.s ? ' s="' + c.s + '"' : '';
          if (c.v === undefined || c.v === null || c.v === '') x += '<c r="' + ref + '"' + sty + '/>';
          else if (typeof c.v === 'number') x += '<c r="' + ref + '"' + sty + '><v>' + c.v + '</v></c>';
          else x += '<c r="' + ref + '"' + sty + ' t="inlineStr"><is><t xml:space="preserve">' + esc(c.v) + '</t></is></c>';
        });
        x += '</row>';
      });
      x += '</sheetData>';
      if (s.merges && s.merges.length) x += '<mergeCells count="' + s.merges.length + '">' + s.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>';
      x += '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>';
      files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: x });
    });
    return zip(files);
  }
  window.XlsxLite = { build: build, Styles: Styles, colName: colName };
})();
