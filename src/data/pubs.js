export default [
  {
    title:
      "Designing Alternative Representations of Confusion Matrices to Support Non-Expert Public Understanding of Algorithm Performance",
    desc:
      "We studied how non-experts use confusion matrices to understand machine learning models. We then developed and tested multiple alternative representations of model performance, finding that contextualized and direcitonal representations are the most useful modifications for improving understanding.",
    id: "confusion",
    teaser: "representations.png",
    venue: "CSCW'20",
    venuelong:
      "ACM Conference on Computer-Supported Cooperative Work and Social Computing (CSCW)",
    year: "2020",
    month: "October",
    location: "Virtual",
    authors: [
      {
        name: "Hong Shen",
        website: "https://www.andrew.cmu.edu/user//hongs/",
      },
      {
        name: "Haojian Jin",
        website: "http://shift-3.com/",
      },
      {
        name: "Ángel Alexander Cabrera",
        website: "https://cabreraalex.com",
      },
      {
        name: "Adam Perer",
        website: "http://perer.org",
      },
      {
        name: "Haiyi Zhu",
        website: "https://haiyizhu.com/",
      },
      {
        name: "Jason Hong",
        website: "http://www.cs.cmu.edu/~jasonh/",
      },
    ],
    bibtex:
      "@inproceedings{Shen2020Confusion, author = {Shen, Hong and Jin, Haojian and Cabrera, Ángel Alexander and Perer, Adam and Zhu, Haiyi and Hong, Jason},title = {Designing Alternative Representations of Confusion Matrices to Support Non-Expert Public Understanding of Algorithm Performance},year = {2020},publisher = {Association for Computing Machinery},address = {New York, NY, USA},url = {https://doi.org/10.1145/3415224},doi = {10.1145/3415224},booktitle = {Proceedings of the ACM 2020 Conference on Computer Supported Cooperative Work},location = {Virtual},series = {CSCW ’20}}",
    abstract:
      "Ensuring effective public understanding of algorithmic decisions that are powered by machine learning techniques has become an urgent task with the increasing deployment of AI systems into our society. In this work, we present a concrete step toward this goal by redesigning confusion matrices for binary classification to support non-experts in understanding the performance of machine learning models. Through interviews (n=7) and a survey (n=102), we mapped out two major sets of challenges lay people have in understanding standard confusion matrices: the general terminologies and the matrix design. We further identified three sub-challenges regarding the matrix design, namely, confusion about the direction of reading the data, layered relations and quantities involved. We then conducted an online experiment with 483 participants to evaluate how effective a series of alternative representations target each of those challenges in the context of an algorithm for making recidivism predictions. We developed three levels of questions to evaluate users' objective understanding. We assessed the effectiveness of our alternatives for accuracy in answering those questions, completion time, and subjective understanding. Our results suggest that (1) only by contextualizing terminologies can we significantly improve users' understanding and (2) flow charts, which help point out the direction of reading the data, were most useful in improving objective understanding. Our findings set the stage for developing more intuitive and generally understandable representations of the performance of machine learning models.",
    pdf: "https://www.andrew.cmu.edu/user//hongs/files/CM_CSCW2020.pdf",
  },
  {
    title:
      "FairVis: Visual Analytics for Discovering Intersectional Bias in Machine Learning",
    desc:
      "FairVis is a visual analytics system that enables data scientists to find potential biases in their machine learning models. It allows users to split their data into subgroups of different features to see how vulnerable groups are performing for various fairness metrics. Additionally, it suggests groups that may be underperforming and can find similar groups.",
    id: "fairvis",
    teaser: "fairvis.png",
    venue: "IEEE VIS'19",
    venuelong:
      "IEEE Conference on Visual Analytics Science and Technology (VAST)",
    year: "2019",
    month: "October",
    location: "Vancouver, Canada",
    authors: [
      {
        name: "Ángel Alexander Cabrera",
        website: "https://cabreraalex.com",
      },
      {
        name: "Will Epperson",
        website: "http://willepperson.com",
      },
      {
        name: "Fred Hohman",
        website: "https://fredhohman.com",
      },
      {
        name: "Minsuk Kahng",
        website: "https://minsuk.com",
      },
      {
        name: "Jamie Morgenstern",
        website: "http://jamiemorgenstern.com",
      },
      {
        name: "Duen Horng (Polo) Chau",
        website: "https://poloclub.github.io/polochau/",
      },
    ],
    bibtex:
      "@INPROCEEDINGS{8986948, author={Á. A. {Cabrera} and W. {Epperson} and F. {Hohman} and M. {Kahng} and J. {Morgenstern} and D. H. {Chau}}, booktitle={2019 IEEE Conference on Visual Analytics Science and Technology (VAST)}, title={FAIRVIS: Visual Analytics for Discovering Intersectional Bias in Machine Learning}, year={2019}, volume={}, number={}, pages={46-56},}",
    abstract:
      "The growing capability and accessibility of machine learning has led to its application to many real-world domains and data about people. Despite the benefits algorithmic systems may bring, models can reflect, inject, or exacerbate implicit and explicit societal biases into their outputs, disadvantaging certain demographic subgroups. Discovering which biases a machine learning model has introduced is a great challenge, due to the numerous definitions of fairness and the large number of potentially impacted subgroups. We present FairVis, a mixed-initiative visual analytics system that integrates a novel subgroup discovery technique for users to audit the fairness of machine learning models. Through FairVis, users can apply domain knowledge to generate and investigate known subgroups, and explore suggested and similar subgroups. FairVis' coordinated views enable users to explore a high-level overview of subgroup performance and subsequently drill down into detailed investigation of specific subgroups. We show how FairVis helps to discover biases in two real datasets used in predicting income and recidivism. As a visual analytics system devoted to discovering bias in machine learning, FairVis demonstrates how interactive visualization may help data scientists and the general public understand and create more equitable algorithmic systems.",
    demo: "https://poloclub.github.io/FairVis/",
    code: "https://github.com/poloclub/FairVis",
    blog:
      "https://medium.com/@cabreraalex/fairvis-discovering-bias-in-machine-learning-using-visual-analytics-acbd362a3e2f",
    pdf: "https://arxiv.org/abs/1904.05419",
    video: "https://vimeo.com/showcase/6524122/video/368702211",
    // slides: "./FairVis.pdf"
  },
];
