/**
 * @OnlyCurrentDoc
 */

 const entityMap = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' '
  };

function onOpen() {
  SpreadsheetApp.getUi()
    .createAddonMenu() 
    .addItem('Launch', 'showSidebar')
    .addToUi();
}

function showSidebar() {
  var html = HtmlService.createTemplateFromFile('Sidebar')
      .evaluate().setTitle('LibLookup');
  SpreadsheetApp.getUi().showSidebar(html);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getMaxUsedRow() {
  return SpreadsheetApp.getActiveSheet().getLastRow()
}

function getRangeValues(ranges) {
  const sheet = SpreadsheetApp.getActiveSheet();
  var rangeValues = []
  for(var i = 0; i < ranges.length; i++) {
    rangeValues.push(sheet.getRange(ranges[i]).getValues())
  }
  return rangeValues
}

function getFirstEmptyColumn() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var firstEmptyColumn = sheet.getLastColumn()+1
  return sheet.getRange(1,firstEmptyColumn).getA1Notation().replace(/[^A-Z].*/,"")
}

function processData(tableJSON,startRow = 1,startCol = 1, append = false) {
  var sheet = SpreadsheetApp.getActiveSheet();
  
  var numrows = tableJSON.length - 1
  var numcols = tableJSON[0].length - 1
  
  if(!append) {
    sheet.clear();
    numrows++
  } else {
    tableJSON = tableJSON.slice(1)
  } 

  if(numrows == 0) {
    tableJSON = [new Array(numcols+1).fill("")]
    numrows = 1
  }

  range = sheet.getRange(startRow, startCol, numrows, numcols) 
  range.setNumberFormat('@');
  range.setWrap(false)
  tableJSON = tableJSON.map(function (row) {return row.map(cell => cell.replace(/&[a-z]+;|&#\d+;/gi, function(match) {
    return entityMap[match] || match;
  }))})
  range.setValues(tableJSON.map(function(row) {return row.slice(1)}))
}

