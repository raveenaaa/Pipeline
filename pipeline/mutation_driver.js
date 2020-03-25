var fs = require('fs');
var xml2js = require('xml2js');
var child  = require('child_process'); 
var parser = new xml2js.Parser();
var Bluebird = require('bluebird')
const path = require('path');
const fuzzer = require('./fuzzer')
const chalk = require('chalk');
const os   = require('os');


let identifyFile = path.join(os.homedir(), '.bakerx', 'insecure_private_key');
let sshExe = `ssh -i "${identifyFile}" -p 2002 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null  vagrant@127.0.0.1`;
let cmd = 'sh /bakerx/fuzzer.sh'

/*
*   Get all the source code files of the iTrust code base
*   Do mutations on them for 100 iterations
*   Prioritize the results by giving the tests with higher number of fails more priority
*/
if( process.env.NODE_ENV != "test")
{   
    var files = [];
    getFiles('iTrust2-v6/iTrust2/src/main/java/edu/ncsu/csc/itrust2', files);
    testResults = mutationTesting(files, 2)
    // prioritize(testResults);
}


/*
*   Recursively get all the files in a directory
*   If a regex is given return files that only match that regex
*/
function getFiles(directory, files, regex=null){
    var dirPath = path.join(__dirname + directory)
    var dir = fs.readdirSync(dirPath, 'utf8')
    dir.forEach(file => {
        var pathOfCurrentItem = path.join(__dirname + directory + '/' + file);
        if (fs.statSync(pathOfCurrentItem).isFile() && (regex == null || regex.exec(file) != null)) {
            files.push(pathOfCurrentItem);
        }
        else if (!fs.statSync(pathOfCurrentItem).isFile()){
            var directorypath = path.join(directory + '\\' + file);
            getFiles(directorypath, files, regex);
        }
    });
}


/*
*   Used to randomly pick upto 10% of the files to be mutated
*   Based on Fisher-Yates shuffling algorithm
*/
function shuffle(array) {
    var remaining = array.length;
    var temp, shuffled_index;

    while (remaining) {
  
      shuffled_index = Math.floor(Math.random() * remaining--);
  
      temp = array[remaining];
      array[remaining] = array[shuffled_index];
      array[shuffled_index] = temp;
    }
  
    return array;
}


/*
*   For a random numberOfFiles upto 10%
*   Read it and mutate it using fuzzer class
*   Save the original file contents for resetting after the test run
*/
function mutateFiles(fileChoice, filePaths, numberOfFiles, originalFiles) {
    shuffle(fileChoice);
    // console.log('Mutated files are:');

    for (file_num = 0; file_num < numberOfFiles; file_num++) {
        file = fs.readFileSync(filePaths[fileChoice[file_num]], 'utf-8');
        originalFiles.push(file);
        // console.log(filePaths[fileChoice[file_num]])
        fs.writeFileSync(filePaths[fileChoice[file_num]], fuzzer.mutateFile(file))
    }
}


/*
* Mutate, run the tests, generate reports, reset
*/
async function mutationTesting(filePaths,iterations)
{    
    var testMap = {}

    fileChoice = [...Array(filePaths.length).keys()]
    
    for (var i = 0; i < iterations-1; i++) {

        numberOfFiles = fuzzer.random().integer(1, 10);
        originalFiles = [];
        mutateFiles(fileChoice, filePaths, numberOfFiles, originalFiles)
        // console.log(chalk.bgGreen(originalFiles.length));

        try
        {
            child.execSync('cd iTrust2-v6/iTrust2 && mvn clean test verify');
        }
        catch(e){
            console.log(e)
            error = String(e)

            // If we don't have a compilation error
            // We can include the test results
            if (!out.includes('COMPILATION ERROR')) {
                var testReports = [];
                getFiles('/iTrust2/target/surefire-reports', testReports, /^TEST/);
                testMap = updateResultMap(testMap, testReports);
                for (tname in testMap) {
                    console.log(chalk.bgGray(tname, testMap.tname))
                } 
            }
            // Else we should not consider that iteration and try again
            else {
                console.log(chalk.redBright('COMPILATION ERROR'));
                i--;
            }
        }
        reset(numberOfFiles, filePaths, fileChoice, originalFiles);    
    }

    return testMap;
}


/*
*   Restore the original code base
*/
function reset(numberOfFiles, filePaths, fileChoice, originalFiles){
    for (file_num = 0; file_num < numberOfFiles; file_num++) {
        fs.writeFileSync(filePaths[fileChoice[file_num]], originalFiles[file_num])
    }
}

/*
* Check if the map contains the test case
* If it doesn't create the entry for the test case
* Then update the entry's results
*/
async function updateResultMap(testMap, testReports){
    for (testReport of testReports) {
        var contents = fs.readFileSync(testReport)
        let xml2json = await Bluebird.fromCallback(cb => parser.parseString(contents, cb));
        var tests = readResults(xml2json);
        
        for (var test of tests) {
            // console.log(chalk.bgGreen(test));
            if (!testMap.hasOwnProperty(test.name)){
                testMap[test.name] = {name: test.name, passed: 0, failed: 0}
            }

            if (test.status == 'passed')
            {
                testMap[test.name].passed++;
            }
            else 
            {
                testMap[test.name].failed++;
            }
        }
    }
    return testMap;
}

/*
* Helper function to read xml test files
*/
function readResults(result)
{
    var tests = [];
    for( var i = 0; i < result.testsuite['$'].tests; i++ )
    {
        var testcase = result.testsuite.testcase[i];
        
        tests.push({
        name:   testcase['$'].name, 
        time:   testcase['$'].time, 
        status: testcase.hasOwnProperty('failure') ? "failed": "passed"
        });
    }    
    return tests;
}


/*
*   Inserts in the array given a location
*/
async function insert(element, array) {
    array.splice(locationOf(element, array) + 1, 0, element);
}
  

/*
*   Using quick sort to find the location of element in sorted array
*   Inserted into the array based on the descending number of failed cases
*   Tests that have failed more number of times will appear first in list
*/
async function locationOf(element, array, start=0, end=array.length) {

    var pivot = Math.floor(start + (end - start) / 2);

    if (start == end) {
      return pivot
    }
    else if (array[pivot].failed < element.failed) 
    {
      return locationOf(element, array, start, pivot);
    } 
    else if (array[pivot].failed > element.failed) 
    {
      return locationOf(element, array, pivot, end);
    }
  }


async function prioritize(testResults){
    var tests = [];

    for (name in testResults){
        if (tests.length == 0)
            tests.push(testResults[name])
        else {
            insert(testResults[name], tests)
        }
    }

    tests.forEach( e => console.log(e));

    return tests;
}