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
        var mutatedFile;
        do {
            // Change == to !=
            // Only the first occurence
            mutatedFile = file.replace('==', '!=')
            
            // Swap 0 with 1
            mutatedFile = mutatedFile.replace('0', '1')

            // Change the content of "strings" in code
            // Positive look ahead for trailing "
            // Positive look back for leading "
            var regex = /(?<=\")(.)+(?=\")/i;
            var randomString = fuzzer.random().string(10)
            mutatedFile = file.replace(regex, randomString);

            // Replace < with > taking care of generics
            // To avoid generics:
            // Match '>' with negative lookbehind to avoid: Class>>, ->
            // Match '<' with negative lookahead to: avoid <Class
            regex = /(?<![a-z>\-])(>)|(<)(?![a-z]+)/i;
            var result = regex.exec(mutatedFile)

            if (result != null){
                var replacement;
                if (result[0] == '>')
                    replacement = '<'
                else 
                    replacement = '>'

                mutatedFile = mutatedFile.substr(0, result.index) + replacement + mutatedFile.substr(result.index+1, mutatedFile.length)
            }      

        } while(fuzzer.random().bool(0.1));

        return mutatedFile;
    }
};

exports.fuzzer = fuzzer;
exports.mutateFile = fuzzer.mutateFile;
exports.random = fuzzer.random;