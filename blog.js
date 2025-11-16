import { getDatabase, ref, onValue, push, update, remove } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js";
import { escapeHTML, formatDate, showToast } from './utils.js';

let db;
let auth;
let storage;
let masterBlogPosts = [];
let blogPostModal;
let viewPostModal;
let quillEditor;

export function initializeBlog(app, storageInstance, blogModalInstance, viewModalInstance) {
    db = getDatabase(app);
    auth = getAuth(app);
    storage = storageInstance;
    blogPostModal = blogModalInstance;
    viewPostModal = viewModalInstance;

    // Initialize the Quill editor
    quillEditor = new Quill('#blogPostEditor', {
        theme: 'snow',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'link'],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['image', 'clean']
            ]
        }
    });

    // Override the default image handler
    quillEditor.getModule('toolbar').addHandler('image', imageHandler);

    // Add event listeners specific to the blog
    document.getElementById('blogPostForm').addEventListener('submit', handleSaveBlogPost);
}

/**
 * Sets the master list of blog posts for the module to use.
 * @param {Array} posts - An array of blog post objects.
 */
export function setBlogPosts(posts) {
    masterBlogPosts = posts;
}

/**
 * Returns a Bootstrap badge class based on the blog post category.
 * @param {string} category - The category of the blog post.
 * @returns {string} A Bootstrap background color class.
 */
function getCategoryBadgeClass(category) {
    switch (category) {
        case 'Daily Activity': return 'bg-primary';
        case 'Feed': return 'bg-success';
        case 'Medicine': return 'bg-info text-dark';
        case 'Disease & Symptoms': return 'bg-danger';
        default: return 'bg-secondary';
    }
}

/**
 * Renders the blog section with all posts.
 */
export function renderBlogSection(posts = [], activeCategory = 'all') {
    const container = document.getElementById('blogPostsContainer');
    const filterContainer = document.getElementById('blogCategoryFilters');
    if (!container || !filterContainer) return;

    // --- 1. Render Category Filters ---
    const categories = ['all', ...new Set(posts.map(p => p.category).filter(Boolean))];
    const filterHtml = categories.map(category => {
        const isActive = category === activeCategory;
        return `
            <button 
                class="btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline-secondary'} blog-category-filter me-2 mb-2" 
                data-category="${escapeHTML(category)}">
                ${category === 'all' ? 'All Posts' : escapeHTML(category)}
            </button>
        `;
    }).join('');
    filterContainer.innerHTML = filterHtml;


    // --- 2. Filter and Render Posts ---
    let postsToRender = [...posts];

    if (activeCategory !== 'all') {
        postsToRender = postsToRender.filter(post => post.category === activeCategory);
    }

    if (postsToRender.length === 0) {
        const message = activeCategory === 'all'
            ? 'No blog posts yet. Click "New Post" to get started!'
            : `No posts found in the category "${escapeHTML(activeCategory)}".`;
        container.innerHTML = `<div class="col-12 text-center"><p class="text-muted">${message}</p></div>`;
        return;
    }

    // Sort posts by date, newest first
    const sortedPosts = postsToRender.sort((a, b) => new Date(b.date) - new Date(a.date));

    const postsHtml = sortedPosts.map(post => {
        const snippet = createExcerpt(post.content);
        const categoryBadgeClass = getCategoryBadgeClass(post.category);
        const coverImageHtml = extractFirstImage(post.content)
            ? `<div class="blog-card-img-container"><img src="${escapeHTML(extractFirstImage(post.content))}" class="blog-card-img" alt="${escapeHTML(post.title)}"></div>`
            : '';

        return `
            <div class="col-md-6 col-lg-4 mb-4">
                <div class="card h-100 shadow-sm blog-card">
                    ${coverImageHtml}
                    <div class="card-body d-flex flex-column">
                        <span class="badge ${categoryBadgeClass} mb-2 align-self-start">${escapeHTML(post.category || 'General')}</span>
                        <h5 class="card-title blog-card-title">${escapeHTML(post.title)}</h5>
                        <p class="card-text small text-muted">By ${escapeHTML(post.author || 'Admin')} on ${formatDate(post.date)}</p>
                        <p class="card-text blog-card-excerpt">${escapeHTML(snippet)}</p>
                    </div>
                    <div class="card-footer bg-transparent border-top-0 pt-0">
                         <div class="d-flex justify-content-between align-items-center">
                            <button class="btn btn-primary btn-sm js-view-blog-post" data-post-id="${post.id}">Read More</button>
                            <div class="btn-group">
                                <button class="btn btn-sm btn-outline-secondary js-edit-blog-post" data-post-id="${post.id}" title="Edit Post"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-sm btn-outline-danger js-delete-blog-post" data-post-id="${post.id}" data-post-title="${escapeHTML(post.title)}" title="Delete Post"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = postsHtml;
}

/**
 * Creates a short excerpt from the blog post content.
 * @param {string} content - The full HTML content of the post.
 * @param {number} length - The approximate length of the excerpt.
 * @returns {string} A plain text excerpt.
 */
function createExcerpt(content, length = 120) {
    if (!content) return '';
    // Strip HTML tags to get plain text
    const text = content.replace(/<[^>]+>/g, '');
    if (text.length <= length) {
        return text;
    }
    // Trim to the length and find the last space to avoid cutting words
    let trimmed = text.substring(0, length);
    trimmed = trimmed.substring(0, Math.min(trimmed.length, trimmed.lastIndexOf(' ')));
    return trimmed + '...';
}

/**
 * Extracts the 'src' of the first <img> tag from an HTML string.
 * @param {string} htmlContent - The HTML content of the blog post.
 * @returns {string|null} The image URL or null if no image is found.
 */
function extractFirstImage(htmlContent) {
    if (!htmlContent) return null;
    const match = htmlContent.match(/<img [^>]*src="([^"]+)"/);
    return match ? match[1] : null;
}

/**
 * Custom handler for the Quill image button.
 * Triggers a file input, uploads the selected image to Firebase Storage,
 * and inserts the image URL into the editor.
 */
function imageHandler() {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        // Show a loading placeholder
        const range = quillEditor.getSelection(true);
        quillEditor.insertText(range.index, '[Uploading image...]', 'user');

        try {
            // Create a unique filename
            const fileName = `blog-images/${Date.now()}-${file.name}`;
            const imageRef = storageRef(storage, fileName);

            // Upload the file
            const snapshot = await uploadBytes(imageRef, file);

            // Get the public URL
            const downloadURL = await getDownloadURL(snapshot.ref);

            // Remove the placeholder and insert the image
            quillEditor.deleteText(range.index, '[Uploading image...]'.length);
            quillEditor.insertEmbed(range.index, 'image', downloadURL);
            quillEditor.setSelection(range.index + 1);

        } catch (error) {
            console.error("Image upload failed:", error);
            quillEditor.deleteText(range.index, '[Uploading image...]'.length);
            alert('Image upload failed. Please try again. See console for details.');
        }
    };
}

export function openBlogPostModal(postId = null) {
    const form = document.getElementById('blogPostForm');
    form.reset();
    document.getElementById('blogPostId').value = postId || '';

    if (postId) {
        document.getElementById('blogPostModalTitle').textContent = 'Edit Blog Post';
        const post = masterBlogPosts.find(p => p.id === postId);
        if (post) {
            document.getElementById('blogPostTitle').value = post.title;
            document.getElementById('blogPostCategory').value = post.category || '';
            quillEditor.root.innerHTML = post.content; // Set content in Quill editor
        }
    } else {
        document.getElementById('blogPostModalTitle').textContent = 'New Blog Post';
        quillEditor.setText(''); // Clear the editor for a new post
    }
    blogPostModal.show();
}

function handleSaveBlogPost(e) {
    e.preventDefault();
    const postId = document.getElementById('blogPostId').value;
    const postData = {
        title: document.getElementById('blogPostTitle').value,
        category: document.getElementById('blogPostCategory').value,
        content: quillEditor.root.innerHTML, // Get HTML content from Quill
        author: auth.currentUser?.displayName || 'Admin',
        date: new Date().toISOString().split('T')[0]
    };

    const promise = postId
        ? update(ref(db, `blogPosts/${postId}`), postData)
        : push(ref(db, 'blogPosts'), postData);

    promise.then(() => {
        blogPostModal.hide();
        showToast('Success', `Blog post has been ${postId ? 'updated' : 'saved'}.`);
    }).catch(error => alert('Error saving post: ' + error.message));
}

export function viewBlogPost(postId) {
    const post = masterBlogPosts.find(p => p.id === postId);
    if (!post) return;

    const modalTitle = document.getElementById('viewPostTitle');
    const postMeta = document.getElementById('viewPostMeta');
    const postBody = document.getElementById('viewPostBody');
    const postImageContainer = document.getElementById('viewPostImageContainer');

    if (!modalTitle || !postMeta || !postBody || !postImageContainer || !viewPostModal) {
        console.error("UI Error: One or more elements for the blog post view modal are missing from the DOM.");
        alert("Could not display the blog post because a UI element is missing. Please check the console for details.");
        return;
    }

    const categoryBadgeClass = getCategoryBadgeClass(post.category);
    
    modalTitle.textContent = post.title;
    postMeta.innerHTML = `
        <span class="badge ${categoryBadgeClass} me-2">${escapeHTML(post.category || 'General')}</span> 
        <span class="text-muted">By</span> <strong>${escapeHTML(post.author)}</strong> 
        <span class="text-muted">on</span> <strong>${formatDate(post.date)}</strong>
    `;

    // Handle cover image
    const firstImage = extractFirstImage(post.content);
    if (firstImage) {
        postImageContainer.innerHTML = `<img src="${escapeHTML(firstImage)}" class="img-fluid rounded mb-3" alt="Cover image for ${escapeHTML(post.title)}">`;
    } else {
        postImageContainer.innerHTML = ''; // Clear it if no image
    }
    postBody.innerHTML = `<div class="ql-snow"><div class="ql-editor">${post.content}</div></div>`; // Render the full HTML content from Quill

    viewPostModal.show();
}

export function deleteBlogPost(postId, postTitle) {
    if (confirm(`Are you sure you want to delete the post "${postTitle}"?`)) {
        remove(ref(db, `blogPosts/${postId}`)).then(() => {
            showToast('Post Deleted', `"${postTitle}" has been deleted.`, 'danger');
        }).catch(error => alert('Error deleting post: ' + error.message));
    }
}