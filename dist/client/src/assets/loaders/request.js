export function applyRequestOptions(loader, { crossOrigin, headers }) {
    if (crossOrigin !== undefined) {
        loader.setCrossOrigin(crossOrigin);
    }
    if (headers !== undefined) {
        loader.setRequestHeader({ ...headers });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL2NsaWVudC9zcmMvYXNzZXRzL2xvYWRlcnMvcmVxdWVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFRQSxNQUFNLFVBQVUsbUJBQW1CLENBQUMsTUFBMkQsRUFBRSxFQUFFLFdBQVcsRUFBRSxPQUFPLEVBQWtCO0lBQ3hJLElBQUksV0FBVyxLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQy9CLE1BQU0sQ0FBQyxjQUFjLENBQUMsV0FBVyxDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELElBQUksT0FBTyxLQUFLLFNBQVMsRUFBRSxDQUFDO1FBQzNCLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLEdBQUcsT0FBTyxFQUFFLENBQUMsQ0FBQztJQUN6QyxDQUFDO0FBQ0YsQ0FBQyJ9