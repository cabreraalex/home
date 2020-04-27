export default [
  {
    title: "Regularizing Black-box Models for Improved Interpretability",
    desc:
      "We introduce a new regularization method for training deep learning models that improves the stability and fidelity of post-hoc explanantion methods like LIME. Through a user study we show that the regularized model empirically improves the quality of explainations.",
    id: "expo",
    teaser: "expo.png",
    venue: "Under Review",
    venuelong: "Under Review",
    year: "2020",
    month: "",
    location: "",
    authors: [
      {
        name: "Gregory Plumb",
        website: "https://gdplumb.github.io/",
      },
      {
        name: "Maruan Al-Shedivat",
        website: "https://www.cs.cmu.edu/~mshediva/",
      },
      {
        name: "Ángel Alexander Cabrera",
        website: "https://cabreraalex.com",
      },
      {
        name: "Adam Perer",
        website: "http://perer.org/",
      },
      {
        name: "Eric Xing",
        website: "http://www.cs.cmu.edu/~epxing/",
      },
      {
        name: "Ameet Talwalkar",
        website: "https://www.cs.cmu.edu/~atalwalk/",
      },
    ],
    bibtex:
      "@article{plumb2019regularizing, title={Regularizing Black-box Models for Improved Interpretability}, author={Plumb, Gregory and Al-Shedivat, Maruan and Cabrera, Ángel Alexander, and Perer, Adam and Xing, Eric and Talwalkar, Ameet}, journal={arXiv preprint arXiv:1902.06787}, year={2020}}",
    abstract:
      "Most of the work on interpretable machine learning has focused on designing either inherently interpretable models, which typically trade-off accuracy for interpretability, or post-hoc explanation systems, which tend to lack guarantees about the quality of their explanations. We explore a hybridization of these approaches by directly regularizing a black-box model for interpretability at training time - a method we call ExpO. We find that post-hoc explanations of an ExpO-regularized model are consistently more stable and of higher fidelity, which we show theoretically and support empirically. Critically, we also find ExpO leads to explanations that are more actionable, significantly more useful, and more intuitive as supported by a user study.",
    pdf: "https://arxiv.org/pdf/1902.06787.pdf",
  },
  {
    title:
      '"Public(s)-in-the-Loop": Facilitating Deliberation of Algorithmic Decisions in Contentious Public Policy Domains',
    desc:
      "We introduce a framework for thinking about how to better involve human influence in algorithmic decision-making of contentious public policy issues.",
    id: "publics",
    teaser: "publics-in-loop.png",
    venue: "Workshop, CHI'20",
    venuelong: "Fair & Responsible AI Workshop at CHI",
    year: "2020",
    month: "May",
    location: "Hawaii, USA",
    authors: [
      {
        name: "Hong Shen",
        website: "https://www.andrew.cmu.edu/user//hongs/",
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
        name: "Jason Hong",
        website: "http://www.cs.cmu.edu/~jasonh/",
      },
    ],
    bibtex:
      '@article{hong2020publics, title={"Public(s)-in-the-Loop": Facilitating Deliberation of Algorithmic Decisions in Contentious Public Policy Domains}, author={Shen, Hong and Cabrera, Ángel Alexander and Perer, Adam and Hong, Jason}, journal={Fair & Responsible AI Workshop at CHI}, year={2020}}',
    abstract:
      "This position paper offers a framework to think about how to better involve human influence in algorithmic decision-making of contentious public policy issues. Drawing from insights in communication literature, we introduce a ``public(s)-in-the-loop'' approach and enumerates three features that are central to this approach: publics as plural political entities, collective decision-making through deliberation, and the construction of publics. It explores how these features might advance our understanding of stakeholder participation in AI design in contentious public policy domains such as recidivism prediction. Finally, it sketches out part of a research agenda for the HCI community to support this work.",
    pdf:
      "https://www.andrew.cmu.edu/user/hongs/files/20_chi_workshop_publics.pdf",
    workshop: "http://fair-ai.owlstown.com/",
  },
  {
    title:
      "Discovery of Intersectional Bias in Machine Learning Using Automatic Subgroup Generation",
    desc:
      "We introduce a method for automatically generating subgroups of instances that a model may be biased against. The instances are first clustered and then described by their dominating features. By ranking and sorting the groups by their performance metrics (F1, accuracy, etc. ) users can spot groups that are underperforming.",
    id: "subgroup-gen",
    teaser: "iclr.png",
    venue: "Workshop, ICLR'19",
    venuelong: "Debugging Machine Learning Models Workshop (Debug ML) at ICLR",
    year: "2019",
    month: "May",
    location: "New Orleans, Louisiana, USA",
    authors: [
      {
        name: "Ángel Alexander Cabrera",
        website: "https://cabreraalex.com",
      },
      {
        name: "Minsuk Kahng",
        website: "https://minsuk.com",
      },
      {
        name: "Fred Hohman",
        website: "https://fredhohman.com",
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
      "@article{cabrera2019discovery, title={Discovery of Intersectional Bias in Machine Learning Using Automatic Subgroup Generation}, author={Cabrera, Ángel Alexander and Kahng, Minsuk and Hohman, Fred and Morgenstern, Jamie and Chau, Duen Horng}, journal={Debugging Machine Learning Models Workshop (Debug ML) at ICLR}, year={2019}}",
    abstract:
      "As machine learning is applied to data about people, it is crucial to understand how learned models treat different demographic groups. Many factors, including what training data and class of models are used, can encode biased behavior into learned outcomes. These biases are often small when considering a single feature (e.g., sex or race) in isolation, but appear more blatantly at the intersection of multiple features. We present our ongoing work of designing automatic techniques and interactive tools to help users discover subgroups of data instances on which a model underperforms. Using a bottom-up clustering technique for subgroup generation, users can quickly find areas of a dataset in which their models are encoding bias. Our work presents some of the first user-focused, interactive methods for discovering bias in machine learning models.",
    pdf:
      "https://debug-ml-iclr2019.github.io/cameraready/DebugML-19_paper_3.pdf",
    workshop: "https://debug-ml-iclr2019.github.io/",
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
        website: "https://cabreraalex.com",
      },
      {
        name: "Fred Hohman",
        website: "https://fredhohman.com",
      },
      {
        name: "Jason Lin",
        website: "http://jlin.xyz",
      },
      {
        name: "Duen Horng (Polo) Chau",
        website: "https://poloclub.github.io/polochau/",
      },
    ],
    bibtex:
      "@article{cabrera2018interactive, title={Interactive Classification for Deep Learning Interpretation}, author={Cabrera, Ángel Alexander and Hohman, Fred and Lin, Jason and Chau, Duen Horng}, journal={Demo, IEEE Conference on Computer Vision and Pattern Recognition (CVPR)}, year={2018}, organization={IEEE}}",
    abstract:
      "We present an interactive system enabling users to manipulate images to explore the robustness and sensitivity of deep learning image classifiers. Using modern web technologies to run in-browser inference, users can remove image features using inpainting algorithms to obtain new classifications in real time. This system allows users to compare and contrast what image regions humans and machine learning models use for classification.",
    website: "http://fredhohman.com/papers/interactive-classification",
    pdf: "https://arxiv.org/abs/1806.05660",
    video: "https://www.youtube.com/watch?v=llub5GcOF6w",
    demo: "https://cabreraalex.github.io/interactive-classification",
    code: "https://github.com/poloclub/interactive-classification",
  },
];
