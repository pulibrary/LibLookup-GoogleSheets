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
const fields = ['recno','name','type']
const record = ['Arthur Clenham','Grievance']
const catalogLink = "https://lib.circumlocution.go.uk/"
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
            this._successHandler(maxRowNumber)
          },
          processData: function(writeBuffer, writeRow, writeColumn, append) {
            if(!append) {
              results = {records: [], row: 0, column: 0}
            } else {
              writeBuffer = writeBuffer.slice(1)
            }
            results.row = writeRow
            results.column = writeColumn
            results.records.push(...writeBuffer)
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
    
    fetchMock.mockResolvedValue({
      text: async () => mockForm,
      json: async() => { 
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
        return {
          catalogLink: catalogLink,
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

    const form = document.querySelector('#queryForm')
    form.dispatchEvent(new Event('submit'), {target: form})
    await jest.advanceTimersToNextTimerAsync()
    expect(document.querySelector("#status").innerHTML).toContain("Retrieved")
    document.querySelector('#abortButton').dispatchEvent(new Event('click'))
    await jest.advanceTimersToNextTimerAsync()
    expect(document.querySelector("#status").innerHTML).toContain("Aborted")
    expect(results.row).toBe(1)
    expect(results.column).toBe(1)
    expect(results.records.length).toBe(pageSize+1)

    batchno = 0
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
  })
});
