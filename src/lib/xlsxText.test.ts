import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { xlsxToText } from './xlsxText'

async function sampleXlsx() {
  const z = new JSZip()
  z.file('xl/workbook.xml', '<workbook><sheets><sheet name="Accounts &amp; Cash" sheetId="1" r:id="rId1"/></sheets></workbook>')
  z.file('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>')
  z.file('xl/sharedStrings.xml', '<sst><si><t>Account</t></si><si><t>Balance</t></si><si><t>Schwab IRA 1234</t></si></sst>')
  z.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row><row r="2"><c r="A2" t="s"><v>2</v></c><c r="C2"><v>612345.67</v></c></row><row r="3"><c r="A3" t="inlineStr"><is><t>Cash</t></is></c><c r="B3"><v>25000</v></c></row></sheetData></worksheet>')
  return z.generateAsync({ type: 'uint8array' })
}
describe('xlsxToText', () => {
  it('reads shared strings, numbers and inline strings with column positions', async () => {
    const t = await xlsxToText(await sampleXlsx())
    expect(t).toContain('=== Sheet: Accounts & Cash ===')
    expect(t).toContain('Account\tBalance')
    expect(t).toContain('Schwab IRA 1234\t\t612345.67')
    expect(t).toContain('Cash\t25000')
  })
})
