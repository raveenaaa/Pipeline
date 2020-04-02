var fs = require('fs');
var xml2js = require('xml2js');
var child  = require('child_process'); 
var parser = new xml2js.Parser();
var Bluebird = require('bluebird')
const path = require('path');
const fuzzer = require('./fuzzer')
const chalk = require('chalk');

const codeDir = 'iTrust2-v6/iTrust2/src/main/java/edu/ncsu/csc/itrust2';
const testDir = 'iTrust2-v6/iTrust2/target/surefire-reports';
/*
*   Get all the source code files of the iTrust code base
*   Do mutations on them for 100 iterations
*   Prioritize the results by giving the tests with higher number of fails more priority
*/
if( process.env.NODE_ENV != "test")
{   
    iterations = Number.parseInt(process.argv[2], 10);
    run(iterations);
}

async function run(iterations=100) {

    var files = [];
    getFiles(codeDir, files);
    testResults = await mutationTesting(files, iterations);
    orderedTestNames = await prioritize(testResults);
    await saveReports(orderedTestNames, testResults);
}

function saveReports(names, testResults) {
    var data = ""
    for (name of names) {
        passed = testResults[name].passed;
        failed = testResults[name].failed;

        data += `${name} => Passed: ${passed} Failed: ${failed}\n`
    }
    console.log('********** Test Report **********');
    console.log(chalk.green(data))
    fs.writeFileSync('report.txt', data, 'utf-8');
}

/*
*   Recursively get all the files in a directory
*   If a regex is given return files that only match that regex
*/
function getFiles(directory, files, regex=null){
    var dir = fs.readdirSync(directory, 'utf8')
    dir.forEach(file => {
        var pathOfCurrentItem = path.join(directory + '/' + file);
        if (fs.statSync(pathOfCurrentItem).isFile() && (regex == null || regex.exec(file) != null)) {
            files.push(pathOfCurrentItem);
        }
        else if (!fs.statSync(pathOfCurrentItem).isFile()){
            var directorypath = path.join(directory + '/' + file);
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
*/
function mutateFiles(fileChoice, filePaths, numberOfFiles) {
    shuffle(fileChoice);

    for (file_num = 0; file_num < numberOfFiles; file_num++) {
        file = fs.readFileSync(filePaths[fileChoice[file_num]], 'utf-8');
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
    
    for (var i = 1; i <= iterations; i++) {
        console.log(chalk(`=========== ITERATION ${i}/${iterations} ===========\n`));
        var error = null
        numberOfFiles = fuzzer.random().integer(1, 10);
        

        try
        {
            console.log('....... Dropping existing database');
            await child.execSync(`mysql --defaults-extra-file=mysql_config.txt -e 'DROP DATABASE IF EXISTS iTrust2'`, {stdio: 'pipe'});

            console.log(chalk.cyan('....... Generating the Test Data'));
            await child.execSync('cd iTrust2-v6/iTrust2 && mvn -f pom-data.xml process-test-classes', {stdio: 'pipe', maxBuffer: 1024 * 1024 * 1024, timeout: 420000});

            mutateFiles(fileChoice, filePaths, numberOfFiles)
            
            console.log(chalk.cyan('....... Running the tests'));
            await child.execSync('cd iTrust2-v6/iTrust2 && mvn clean test verify', {maxBuffer: 1024 * 1024 * 1024, stdio: 'pipe'});
        }
        catch(e){
            error = e.stdout
        }
        finally {
            // If we don't have a compilation error/failure or build has passed
            // We can include the test results

            var regex = /compilation (error|failure)/i;
            var result = regex.exec(error);

            if (result == null && fs.existsSync(testDir)) {
                var testReports = [];
                getFiles(testDir, testReports, /^TEST/);
                testMap = await updateResultMap(testMap, testReports);
            }
            // Else we should not consider that iteration and try again
            else {
                if (result != null) {
                    console.log(chalk.redBright('....... COMPILATION ERROR'));
                }
                else {
                    console.log(chalk.redBright('........ Unexpected error'));
                }
                console.log(chalk.redBright(`....... Re-running iteration ${i}`));
                i--;
            }
            reset(); 
        }   
    }
    return testMap;
}

/*
*   Restore the original code base
*   Drop the iTrust2 database
*/
function reset(){
    try{
        console.log('....... Resetting iTrust2 repository\n');
        child.execSync('cd iTrust2-v6/ && git reset --hard HEAD', {stdio: "pipe"});
    }
    catch(e) {
        console.log(chalk.redBright(e));
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
    var classname = result.testsuite['$'].name;
    for( var i = 0; i < result.testsuite['$'].tests; i++ )
    {   
        var testcase = result.testsuite.testcase[i];
        var testname = testcase['$'].name;
        tests.push({
        name:   classname.concat(':', testname), 
        time:   testcase['$'].time, 
        status: testcase.hasOwnProperty('failure') ? "failed": "passed"
        });
    }    
    return tests;
}

/*
*   Inserts in the array given a location
*/
async function insert(element, array, testMap) {
    array.splice(await locationOf(element, array, testMap), 0, element);
}

/*
*   Using quick sort to find the location of element in sorted array
*   Inserted into the array based on the descending number of failed cases
*   Tests that have failed more number of times will appear first in list
*/
async function locationOf(element, array, testMap, start=0, end=array.length) {

    var pivot = Math.floor(start + (end - start) / 2);

    if (start == end) {
      return pivot
    }
    else if (testMap[array[pivot]].failed < testMap[element].failed) 
    {
      return locationOf(element, array, testMap, start, pivot);
    } 
    else if (testMap[array[pivot]].failed > testMap[element].failed)
    {
      return locationOf(element, array, testMap, pivot + 1, end);
    } 
    else {
        return pivot + 1
    }
  }

async function prioritize(testResults){
    var tests = [];

    for (test in testResults){
        if (tests.length == 0)
            tests.push(testResults[test].name)
        else {
            await insert(testResults[test].name, tests, testResults)
        }
    }
    return tests;
}