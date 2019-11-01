export default [
  {
    title:
      "FairVis: Visual Analytics for Discovering Intersectional Bias in Machine Learning",
    desc:
      "FairVis is a visual analytics system that enables data scientists to find potential biases in their machine learning models. It allows users to split their data into subgroups of different features to see how vulnerable groups are performing for various fairness metrics. Additionally, it suggests groups that may be underperforming and can find similar groups.",
    id: "fairvis",
    teaser: "fairvis.png",
    venue: "IEEE VIS'19",
    venuelong: "IEEE Transactions on Visualization and Computer Graphics",
    year: "2019",
    month: "October",
    location: "Vancouver, Canada",
    authors: [
      {
        name: "Ángel Alexander Cabrera",
        website: "https://cabreraalex.com"
      },
      {
        name: "Will Epperson",
        website: "http://willepperson.com"
      },
      {
        name: "Fred Hohman",
        website: "https://fredhohman.com"
      },
      {
        name: "Minsuk Kahng",
        website: "https://minsuk.com"
      },
      {
        name: "Jamie Morgenstern",
        website: "http://jamiemorgenstern.com"
      },
      {
        name: "Duen Horng (Polo) Chau",
        website: "https://poloclub.github.io/polochau/"
      }
    ],
    bibtex:
      "@article{cabrera2019fairvis, title={FairVis: Visual Analytics for Discovering Intersectional Bias in Machine Learning}, author={Cabrera, {'A}ngel Alexander and Epperson, Will and Hohman, Fred and Kahng, Minsuk and Morgenstern, Jamie and Chau, Duen Horng}, journal={IEEE Conference on Visual Analytics Science and Technology (VAST)}, year={2019}, publisher={IEEE}}",
    abstract:
      "The growing capability and accessibility of machine learning has led to its application to many real-world domains and data about people. Despite the benefits algorithmic systems may bring, models can reflect, inject, or exacerbate implicit and explicit societal biases into their outputs, disadvantaging certain demographic subgroups. Discovering which biases a machine learning model has introduced is a great challenge, due to the numerous definitions of fairness and the large number of potentially impacted subgroups. We present FairVis, a mixed-initiative visual analytics system that integrates a novel subgroup discovery technique for users to audit the fairness of machine learning models. Through FairVis, users can apply domain knowledge to generate and investigate known subgroups, and explore suggested and similar subgroups. FairVis' coordinated views enable users to explore a high-level overview of subgroup performance and subsequently drill down into detailed investigation of specific subgroups. We show how FairVis helps to discover biases in two real datasets used in predicting income and recidivism. As a visual analytics system devoted to discovering bias in machine learning, FairVis demonstrates how interactive visualization may help data scientists and the general public understand and create more equitable algorithmic systems.",
    demo: "https://poloclub.github.io/FairVis/",
    code: "https://github.com/poloclub/FairVis",
    blog:
      "https://medium.com/@cabreraalex/fairvis-discovering-bias-in-machine-learning-using-visual-analytics-acbd362a3e2f",
    pdf: "https://arxiv.org/abs/1904.05419",
    video: "https://vimeo.com/showcase/6524122/video/368702211",
    slides: "./FairVis.pdf"
  },
  {
    title:
      "Discovery of Intersectional Bias in Machine Learning Using Automatic Subgroup Generation",
    desc:
      "We introduce a method for automatically generating subgroups of instances that a model may be biased against. The instances are first clustered and then described by their dominating features. By ranking and sorting the groups by their performance metrics (F1, accuracy, etc. ) users can spot groups that are underperforming.",
    id: "subgroup-gen",
    teaser: "iclr.png",
    venue: "Workshop, ICLR'19",
    venuelong: "Debugging Machine Learning Models Workshop at ICLR (Debug ML)",
    year: "2019",
    month: "May",
    location: "New Orleans, Louisiana, USA",
    authors: [
      {
        name: "Ángel Alexander Cabrera",
        website: "https://cabreraalex.com"
      },
      {
        name: "Minsuk Kahng",
        website: "https://minsuk.com"
      },
      {
        name: "Fred Hohman",
        website: "https://fredhohman.com"
      },
      {
        name: "Jamie Morgenstern",
        website: "http://jamiemorgenstern.com"
      },
      {
        name: "Duen Horng (Polo) Chau",
        website: "https://poloclub.github.io/polochau/"
      }
    ],
    bibtex:
      "@article{cabrera2019discovery, title={Discovery of Intersectional Bias in Machine Learning Using Automatic Subgroup Generation}, author={Cabrera, {'A}ngel Alexander and Kahng, Minsuk and Hohman, Fred and Morgenstern, Jamie and Chau, Duen Horng}, journal={Debugging Machine Learning Models Workshop (Debug ML) at ICLR}, year={2019}}",
    abstract:
      "As machine learning is applied to data about people, it is crucial to understand how learned models treat different demographic groups. Many factors, including what training data and class of models are used, can encode biased behavior into learned outcomes. These biases are often small when considering a single feature (e.g., sex or race) in isolation, but appear more blatantly at the intersection of multiple features. We present our ongoing work of designing automatic techniques and interactive tools to help users discover subgroups of data instances on which a model underperforms. Using a bottom-up clustering technique for subgroup generation, users can quickly find areas of a dataset in which their models are encoding bias. Our work presents some of the first user-focused, interactive methods for discovering bias in machine learning models.",
    pdf:
      "https://debug-ml-iclr2019.github.io/cameraready/DebugML-19_paper_3.pdf",
    workshop: "https://debug-ml-iclr2019.github.io/"
  },
  {
    title: "Interactive Classification for Deep Learning Interpretation",
    desc:
      "We developed an interactive system that allows users to modify images to explore the weaknesses and strenghts of image classification models. Users can 'inpaint' or remove parts of an image and see how it impacts their classification.",
    id: "interactive-classification",
    teaser: "interactive.png",
    venue: "Demo, CVPR'18",
    venuelong: "Demo at IEEE Computer Vision and Pattern Recognition (CVPR)",
    year: "2018",
    month: "June",
    location: "Salt Lake City, Utah, USA",
    authors: [
      {
        name: "Ángel Alexander Cabrera",
        website: "https://cabreraalex.com"
      },
      {
        name: "Fred Hohman",
        website: "https://fredhohman.com"
      },
      {
        name: "Jason Lin",
        website: "http://jlin.xyz"
      },
      {
        name: "Duen Horng (Polo) Chau",
        website: "https://poloclub.github.io/polochau/"
      }
    ],
    bibtex:
      "@article{cabrera2018interactive, title={Interactive Classification for Deep Learning Interpretation}, author={Cabrera, {'A}ngel Alexander and Hohman, Fred and Lin, Jason and Chau, Duen Horng}, journal={Demo, IEEE Conference on Computer Vision and Pattern Recognition (CVPR)}, year={2018}, organization={IEEE}}",
    abstract:
      "We present an interactive system enabling users to manipulate images to explore the robustness and sensitivity of deep learning image classifiers. Using modern web technologies to run in-browser inference, users can remove image features using inpainting algorithms to obtain new classifications in real time. This system allows users to compare and contrast what image regions humans and machine learning models use for classification.",
    website: "http://fredhohman.com/papers/interactive-classification",
    pdf: "https://arxiv.org/abs/1806.05660",
    video: "https://www.youtube.com/watch?v=llub5GcOF6w",
    demo: "https://cabreraalex.github.io/interactive-classification",
    code: "https://github.com/poloclub/interactive-classification"
  }
];
