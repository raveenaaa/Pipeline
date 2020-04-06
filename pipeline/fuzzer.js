const Random = require('random-js');

class fuzzer {
    static random() {
        return fuzzer._random || fuzzer.seed(0)
    }
    
    static seed (kernel) {
        fuzzer._random = new Random.Random(Random.MersenneTwister19937.seed(kernel));
        return fuzzer._random;
    }

    static mutateFile(file) {
        
        // Change == to !=
        // Only the first occurence
        if (fuzzer.random().bool(0.1))
            file = file.replace(/==/g, '!=');
        
        // Relace 0 with 1
        if (fuzzer.random().bool(0.1))
            file = file.replace(/0/g, '1');

        // Replace 1 with 0
        else if (fuzzer.random().bool(0.1))
            file = file.replace(/1/g, '0');

        // Change the content of "strings" in code
        // Positive look ahead for trailing "
        // Positive look back for leading "
        var regex = /(?<=\")(.)+(?=\")/i;
        var randomString = fuzzer.random().string(10)
        if (fuzzer.random().bool(0.1))
            file = file.replace(regex, randomString);

        // Replace true with false
        if (fuzzer.random().bool(0.1))
            file = file.replace(/true/g, 'false');

        // Replace false with true
        else if (fuzzer.random().bool(0.1)){
            file = file.replace(/false/g, 'true');
        }

        // Replace numbers with any random numbers
        if (fuzzer.random().bool(0.1))
            file = file.replace(/[0-9]+/g, fuzzer.random().integer(0, 100));
            
        // Replace < with > taking care of generics
        // To avoid generics:
        // Match '>' with negative lookbehind to avoid: Class>>, ->
        // Match '<' with negative lookahead to: avoid <<Class, <?>
        regex = /(?<![a-z>?\-])(>)|(<)(?![a-z?<]+)/i;
        var result = regex.exec(file)

        if (fuzzer.random().bool(0.1) && result != null){
            var replacement;
            if (result[0] == '>')
                replacement = '<'
            else if (result[0] == '<')
                replacement = '>' 
            else 
                return file;

            file = file.substr(0, result.index) + replacement + file.substr(result.index+1, file.length)     
        }
        return file;
    }
};

exports.fuzzer = fuzzer;
exports.mutateFile = fuzzer.mutateFile;
exports.random = fuzzer.random;