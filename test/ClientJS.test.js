const fs = require('fs')
const path = require('path')
const { JSDOM } = require("jsdom")
var ClientJS

const sidebarHTML = '../Sidebar.html'
const clientJSHTML = '../ClientJS.html'
const clientJSFilename = '../ClientJS.js'
const mockFormHTML = './MockForm.html'

const notRunning = "LibLookup Desktop app is not running."
const firstEmptyColumnLetter = "C"
const firstEmptyColumnNumber = 3
const maxRowNumber = 1234

const catalogs = ["Grievances","Petitions"]
const query = "date = 1857"
const batchQuery = "id = [[A]] AND date = [[B]]"
const batchRanges = [[1,2,3,4,5,""],[6,7,8,9,0,""]]
const fields = ['recno','name','type']
const record = ['Arthur Clenham','Grievance']
const catalogLink = "https://office.circumlocution.go.uk/"
const numberOfRecords = 200
const pageSize = 50

describe('Inline HTML JavaScript Test', () => {

  let fetchMock;
  let mockForm;
  let dom;
  let results;

  beforeAll(() => {
    const clientJStext = fs.readFileSync(path.resolve(__dirname, clientJSHTML), 'utf8');
    var script = clientJStext.replace(/^<script>/,"").replace(/<\/script>$/,"");
    script = script.replace(/^\s*runLibLookup.*/,"\n")
    const functions = clientJStext.match(/function [^(]+/g).map(f => f.replace(/^function /,""))
    script += "\nmodule.exports = {" + functions.join(',') + "}"
    fs.writeFileSync(path.resolve(__dirname,clientJSFilename),script,'utf8');
  })

  beforeEach(() => {  
    jest.useFakeTimers()
    jest.clearAllMocks()
    ClientJS = require("../ClientJS.js")  
    const sidebar = fs.readFileSync(path.resolve(__dirname, sidebarHTML ), 'utf8');  
    mockForm = fs.readFileSync(path.resolve(__dirname, mockFormHTML ), 'utf8');    
    dom = new JSDOM(sidebar)
    global.window = dom.window
    global.document = window.document
    fetchMock = jest.fn()
    global.fetch = fetchMock
    global.FormData = window.FormData
    global.Event = window.Event
    global.google = {
      script: {
        run: {
          withSuccessHandler: function(callback) {
            this._successHandler = callback;
            return this; 
          },
          getFirstEmptyColumn: function() {
            this._successHandler(firstEmptyColumnLetter)
          },
          getMaxUsedRow: function() {
            this._successHandler((results) ? maxRowNumber: 0)
          },
          getRangeValues: function(ranges) {
            this._successHandler(batchRanges)
          }, 
          processData: async function(writeBuffer, writeRow, writeColumn, append) {
            if(!append) {
              results = {records: [], row: 0, column: 0}
            } else {
              writeBuffer = writeBuffer.slice(1)
            }
            results.row = writeRow
            results.column = writeColumn
            results.records.push(...writeBuffer)
            //simulate latency of writing to spreadsheet
            await jest.advanceTimersByTimeAsync(150)
            this._successHandler()
          }
        }
      }
    }
  })

  afterEach(() => {
    delete global.window;
    delete global.document;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });


  test('Simulate LibLookup Desktop App not running', async () => {  
    fetchMock.mockRejectedValue(new Error("Test LibLookup Not Running")); 
    await ClientJS.runLibLookup(document)
    expect(document.querySelector("#content").innerHTML).toBe(notRunning)
  });

  test('Successfully load form, run in query mode', async () => {
    let batchno = 0
    let mode = "abort"
    
    fetchMock.mockResolvedValue({
      text: async () => mockForm,
      json: async () => { 
        var recordsArray = [fields]
        if(batchno == 0) {
          recordsArray.push([1,1,...record])
        } else {
          for(i = 1; i <= pageSize; i++) {
            const recno = (batchno-1)*pageSize+i
            recordsArray.push([recno,recno,...record])
          }
        }
        batchno++
        //simulate fetch latency
        jest.advanceTimersToNextTimer()
        return {
          catalogLink:  (mode == "complete") ? catalogLink : "",
          numberOfRecords: numberOfRecords,
          records: recordsArray
        } 
      }
    }); 

    await ClientJS.runLibLookup(document)
    document.querySelector("select[name='catalog']").innerHTML = 
      catalogs.map(c => `<option>${c}</option>`)
    document.querySelector("select[name='catalog']").value = catalogs[0]
    document.querySelector("input[name='maxRecs']").value = numberOfRecords + 1
    document.querySelector("input[name='q']").value = query
    document.querySelector("input[name='displayFields']").value = fields.join("|")
    document.querySelector('#allRowsButton').dispatchEvent(new window.Event('click'))
    expect(document.querySelector("#endrow").value).toBe(String(1))

    const form = document.querySelector('#queryForm')
    form.dispatchEvent(new Event('submit'), {target: form})
    await jest.advanceTimersToNextTimerAsync()

    expect(document.querySelector("#status").innerHTML).toContain("Retrieved")
    document.querySelector('#abortButton').dispatchEvent(new Event('click'))
    await jest.advanceTimersToNextTimerAsync()

    expect(document.querySelector("#status").innerHTML).toContain("Aborted")

    expect(results.row).toBe(pageSize+2)
    expect(results.column).toBe(1)
    expect(results.records.length).toBe((pageSize*2)+1)

    batchno = 0
    mode = "complete"
    form.dispatchEvent(new Event('submit'), {target: form})
    while(document.querySelector("#status").innerHTML != 'Done!') {
      await jest.advanceTimersToNextTimerAsync()

    }
    expect(results.records.length).toBe(numberOfRecords+1)

    expect(document.querySelector('#content').firstElementChild.id).toBe("queryForm")
    const colLetter = document.querySelector('#resultColumn').value
    const colNumber = ClientJS.columnLetterToNumber(colLetter)
    expect(colLetter).toBe(firstEmptyColumnLetter)
    expect(colNumber).toBe(firstEmptyColumnNumber)

    document.querySelector('#startrow').value = String(999)
    document.querySelector('#allRowsButton').dispatchEvent(new window.Event('click'))
    expect(document.querySelector('#startrow').value).toBe(String(1))
    expect(document.querySelector('#endrow').value).toBe(String(maxRowNumber))
    expect(document.querySelector("#catalogLink").innerHTML).toContain(catalogLink)
  })

  test('Successfully load form, run in batch mode', async () => {
    let batchno = 1
    results = {records: [], row: 0, column: 0}

    fetchMock.mockResolvedValue({
      text: async () => mockForm,
      json: async () => { 
        var recordsArray = [fields]
        for(i = 1; i <= batchno; i++) {
          recordsArray.push([batchno,batchno,...record])
        }
        batchno++
        //simulate fetch latency
        jest.advanceTimersToNextTimer()
        return {
          catalogLink: "",
          numberOfRecords: recordsArray.length,
          records: recordsArray
        } 
      }
    }); 

    await ClientJS.runLibLookup(document)
    document.querySelector("select[name='catalog']").innerHTML = 
      catalogs.map(c => `<option>${c}</option>`)
    document.querySelector("select[name='catalog']").value = catalogs[1]
    document.querySelector("input[name='maxRecs']").value = numberOfRecords
    document.querySelector("input[name='q']").value = batchQuery
    document.querySelector("input[name='displayFields']").value = fields.join("|")
    document.querySelector("input[name='startrow']").value = 1
    document.querySelector("input[name='endrow']").value = batchRanges[0].length
    document.querySelector("input[name='resultColumn']").value = firstEmptyColumnLetter

    const form = document.querySelector('#queryForm')
    form.dispatchEvent(new Event('submit'), {target: form})
    await jest.advanceTimersToNextTimerAsync()
    expect(document.querySelector("#status").innerHTML).toContain("Searching row")
    while(document.querySelector("#status").innerHTML != 'Done!') {
      await jest.advanceTimersToNextTimerAsync()
    }
    expect(results.records.length).toBe(batchRanges[0].length)
  })

});