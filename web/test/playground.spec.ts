import {type Page, expect, test} from '@playwright/test';

const input = `\
{
  "type": "here"
}`;
const commented = `\
0xa164747970656468657265
a1   -- Map (Length: 1 pair)
  64 --   [key 0] UTF8 (Length: 4): "type"
    74797065
  64 --   [val 0] UTF8 (Length: 4): "here"
    68657265
`;
const hex = 'a164747970656468657265';
const b64 = 'oWR0eXBlZGhlcmU=';
const b64url = 'oWR0eXBlZGhlcmU';

async function checkMonacoText(
  page: Page, modelName: string, value: string
): Promise<void> {
  await expect.poll(async() => page.evaluate(
    // @ts-expect-error _cbor2testing added just for testability.
    (name: string) => window._cbor2testing[name].getValue(),
    modelName
  )).toBe(value);
}

test.beforeEach(async({page}) => {
  await page.goto('playground/');
  await expect(page).toHaveTitle(/cbor2 playground/);
});

async function checkOutputs(page: Page): Promise<void> {
  await page.locator('#output-fmt').selectOption('commented');
  await checkMonacoText(page, 'outModel', commented);
  await page.locator('#output-fmt').selectOption('diagnostic');
  await checkMonacoText(page, 'outModel', '{"type": "here"}');
  await page.locator('#output-fmt').selectOption('hex');
  await checkMonacoText(page, 'outModel', hex);
  await page.locator('#output-fmt').selectOption('base64');
  await checkMonacoText(page, 'outModel', b64);
  await page.locator('#output-fmt').selectOption('base64url');
  await checkMonacoText(page, 'outModel', b64url);
  await page.locator('#output-fmt').selectOption('js');
  await checkMonacoText(page, 'outModel', "{ type: 'here' }");
  await page.locator('#output-fmt').selectOption('JSON');
  await checkMonacoText(page, 'outModel', input);
}

test('Conversions', async({page}) => {
  await expect(page.locator('#input-fmt')).toHaveValue('JSON');
  await checkMonacoText(page, 'inModel', input);
  await expect(page.locator('#output-fmt')).toHaveValue('commented');
  await checkMonacoText(page, 'outModel', commented);

  await checkOutputs(page);

  await page.locator('#output-fmt').selectOption('commented');
  await page.getByRole('button', {name: 'Copy to input'}).click();
  await checkOutputs(page);

  await page.locator('#output-fmt').selectOption('diagnostic');
  await expect(page.getByRole('button', {name: 'Copy to input'})).toBeEnabled();
  await checkOutputs(page);

  await page.locator('#output-fmt').selectOption('hex');
  await page.getByRole('button', {name: 'Copy to input'}).click();
  await checkOutputs(page);

  await page.locator('#output-fmt').selectOption('base64');
  await page.getByRole('button', {name: 'Copy to input'}).click();
  await checkOutputs(page);

  await page.locator('#output-fmt').selectOption('base64url');
  await page.getByRole('button', {name: 'Copy to input'}).click();
  await checkOutputs(page);

  await page.locator('#output-fmt').selectOption('js');
  await page.getByRole('button', {name: 'Copy to input'}).click();
  await checkOutputs(page);

  await page.locator('#output-fmt').selectOption('JSON');
  await page.getByRole('button', {name: 'Copy to input'}).click();
  await checkOutputs(page);
});

test('Encode Options', async({page}) => {
  await page.getByRole('button', {name: 'Encoding Options \u2795'}).click();
  await page.locator('#dcborEncode').check();
  await expect(page.getByLabel('avoidInts')).not.toBeChecked();
  await expect(page.locator('#cdeEncode')).toBeChecked();
  await expect(page.getByLabel('collapseBigInts')).toBeChecked();
  await expect(page.getByLabel('float64')).not.toBeChecked();
  await expect(page.getByLabel('flushToZero')).not.toBeChecked();
  await expect(page.getByLabel('forceEndian')).toHaveValue('null');
  await expect(page.getByLabel('ignoreOriginalEncoding')).toBeChecked();
  await expect(page.getByLabel('largeNegativeAsBigInt')).toBeChecked();
  await expect(page.locator('#rejectBigIntsEncode')).not.toBeChecked();
  await expect(page.getByLabel('rejectCustomSimples')).toBeChecked();
  await expect(page.locator('#rejectDuplicateKeysEncode')).toBeChecked();
  await expect(page.locator('#rejectFloatsEncode')).not.toBeChecked();
  await expect(page.locator('#rejectUndefinedEncode')).toBeChecked();
  await expect(page.getByLabel('simplifyNegativeZero')).toBeChecked();
  await expect(page.locator('#sortKeysEncode')).toHaveValue('coreDeterministic');
});

test('Decode Options', async({page}) => {
  await page.getByRole('button', {name: 'Decoding Options \u2795'}).click();
  await page.locator('#dcbor').check();
  await expect(page.getByLabel('boxed')).not.toBeChecked();
  await expect(page.locator('#cde')).toBeChecked();
  await expect(page.getByLabel('preferMap')).not.toBeChecked();
  await expect(page.getByLabel('rejectLargeNegatives')).toBeChecked();
  await expect(page.locator('#rejectBigInts')).not.toBeChecked();
  await expect(page.locator('#rejectDuplicateKeys')).toBeChecked();
  await expect(page.locator('#rejectFloats')).not.toBeChecked();
  await expect(page.locator('#rejectInts')).not.toBeChecked();
  await expect(page.locator('#rejectLongLoundNaN')).toBeChecked();
  await expect(page.locator('#rejectNegativeZero')).toBeChecked();
  await expect(page.locator('#rejectSimple')).toBeChecked();
  await expect(page.locator('#rejectStreaming')).toBeChecked();
  await expect(page.locator('#rejectSubnormals')).not.toBeChecked();
  await expect(page.locator('#rejectUndefined')).toBeChecked();
  await expect(page.locator('#requirePreferred')).toBeChecked();
  await expect(page.locator('#saveOriginal')).not.toBeChecked();
  await expect(page.locator('#sortKeysDecode')).toHaveValue('coreDeterministic');
});
