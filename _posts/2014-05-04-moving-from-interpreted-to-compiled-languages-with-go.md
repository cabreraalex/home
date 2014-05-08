---
layout: blog
---

When I first decided to learn how to program, my endeavour began with an Internet scavenger hunt to find out which language would be the best for a beginner to start with. C! Lisp! Java! Ruby! Every single article or post I read promoted a different language, but in the end the most popular option was Python.  A programming language easy to understand and use, Python has become the essential entry-level language to learn to program in, and is even used in [MIT's introduction to Computer Science](http://ocw.mit.edu/courses/electrical-engineering-and-computer-science/6-00-introduction-to-computer-science-and-programming-fall-2008/index.htm) course.  Python is very adventageous for beginner programmers, as it allows learners  to easily explore data structures, loops, conditionals, algorithms, and more through a simple, out of the way syntax.  Many applications have been and are being built in Python, as it is still a powerhouse in the programming world, but when beginners want to move on to a different language, there is a very high probability that they will stumble upon a compiled one.  Althought the knowledge and skills of basic programming and computer science carry over from one language to another, Make files, linking, and compilation can be hard to learn and understand coming from an interpreted language.

Go (Golang), Google's new and rapidly growing compiled language, is a great choice for Python (or any similar interpreted language) programmers who have not had experience with compiled languages.  Although Go has a much more thorough typing style which may seem foreign at first, it's amazing directory and workflow structure easily allows newcomers to undestand the process of compilation. Instead of fragmented, non-standard folders, tools, compilers and the like, Go has a strict and standarized system which leads to well-structured and understandable code.

One of the first steps in  setting up Go is [creating a GOPATH](http://golang.org/doc/code.html), the directory in which all of your Go code will be stored and organized. In this directory three folders are made, one each for your source code, libraries, and binaries, `/src /pkg /bin`.  These three folders split up the main components of Go's build process and make it easy to undestand the processes which occur during compilation.

To create a simple command line calculator and showcase its potential, we will create a folder in `/src` called `example/calculator`. Inside of this Go "package", we can then write a main file and add an extra package to add functionality:

```
// calculator/main.go

package main

import (
    "fmt"
    "example/calculator/arithmetic"
)

func main() {
    x := 5
    y := 6
    fmt.Println(arithmetic.Add(x, y))
    fmt.Println(arithmetic.Subtract(x,y))
}
```

```
// calculator/arithmetic/addandsubtract.go

package arithmetic

func Add(x, y int) int {
    return x + y
}

func Subtract(x, y int) int {
    return x - y;
}
```

These files create a Go package, `calculator`, which imports and calls in functions from another package, `arithmetic`, in its main program. This should be common to Pythonistas, as packages and imports are usually present in larger applications.  Where Go deviates is when the program is actually run and/or installed. To simply run a program like the one above, the command `go run main.go` instantly compiles and runs the file along with all of its dependencies. Although this is a very simple way to program in Go, the true nature of Go as a compiled language lays in the commands `go build` and `go install`.

`go build` is the typical compiling command for Go, as `gcc` would be for C or C++. This command takes in files and converts them into either executables, the program files you actually run, or the package objects, the extra imported packages which are called by the executable. Go goes beyond simple compilation with `go install`, a command which builds packages and then puts executables in the `/bin` folder and package objects in the `/pkg` folder. For example, running `go install` inside the calculator package will create an executable inside the `/bin` folder called calculator and the supporting .a files in `/pkg`.

Go's simple compilation series and strict organization makes it a very viable and open option to learn about compiled languages  for programmers who started with interpreted languages. The simplicity and speed of `go run` coupled with the scalability and organization of a compiled language makes Go an increasingly appealing option for both newcomers to compiled languages and veterans who want a breath of fresh air.
